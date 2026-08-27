/**
 * Magic-byte image validation and Workers KV persistence for admin product
 * uploads. Content wins over client hints: the stored extension/MIME derive ONLY
 * from the verified byte signature — never from the filename or declared type.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** KV free-tier storage cap (1 GB) with 100 MB headroom for safety. */
export const KV_MAX_STORAGE_BYTES = 900 * 1024 * 1024;
/** KV free-tier daily write cap. */
export const KV_MAX_WRITES_PER_DAY = 1_000;
/** Warning threshold — log when estimated usage exceeds this fraction. */
export const KV_USAGE_WARN_THRESHOLD = 0.8;

export type DetectedImage = {
  ext: "jpg" | "png" | "webp";
  mime: "image/jpeg" | "image/png" | "image/webp";
};

// Contiguous signatures checked in order; webp is handled separately below
// because its marker is split ("RIFF" + a skipped 4-byte size field + "WEBP").
const FIXED_SIGNATURES: readonly {
  bytes: readonly number[];
  ext: DetectedImage["ext"];
  mime: DetectedImage["mime"];
}[] = [
  { bytes: [0xff, 0xd8, 0xff], ext: "jpg", mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: "png", mime: "image/png" },
];

const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50];
// "RIFF" + size + "WEBP" must all fit before the container can be webp.
const WEBP_MIN_LENGTH = RIFF_MAGIC.length + 4 + WEBP_MAGIC.length;

function startsWithMagic(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte);
}

export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  for (const signature of FIXED_SIGNATURES) {
    if (startsWithMagic(bytes, signature.bytes)) {
      return { ext: signature.ext, mime: signature.mime };
    }
  }
  if (
    bytes.length >= WEBP_MIN_LENGTH &&
    startsWithMagic(bytes, RIFF_MAGIC) &&
    startsWithMagic(bytes.subarray(RIFF_MAGIC.length + 4), WEBP_MAGIC)
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: "too_large" | "unsupported" | "storage_unavailable" };

/**
 * Minimal structural view of a Cloudflare KV namespace covering what the app
 * exercises today: arrayBuffer writes from admin uploads and reads from the
 * /media/[...key] serving route. Exported so app.d.ts reuses it without
 * pulling the @cloudflare/workers-types globals into client code (same
 * rationale as D1Database there).
 */
export interface KvLikeNamespace {
  put(key: string, value: ArrayBuffer): Promise<void>;
  get(key: string, options: { type: "arrayBuffer" }): Promise<ArrayBuffer | null>;
  list?: (opts?: { prefix?: string; limit?: number }) => Promise<{
    keys: Array<{ name: string; size?: number }>;
    list_complete: boolean;
    cache_status: string | null;
  }>;
}

export interface KvUsageEstimate {
  imageCount: number;
  estimatedBytes: number;
  warnLevel: "ok" | "approaching" | "exceeded";
}

/**
 * Estimates KV usage by counting product image keys and summing their sizes.
 * Falls back to count-only if size metadata is unavailable (some KV drivers
 * don't return key sizes).
 */
export async function estimateKvUsage(ns: KvLikeNamespace): Promise<KvUsageEstimate> {
  let imageCount = 0;
  let estimatedBytes = 0;

  if (!ns.list) return { imageCount: 0, estimatedBytes: 0, warnLevel: "ok" };

  try {
    let cursor: string | undefined;
    do {
      const result = await ns.list({ prefix: "products/", limit: 1000 });
      for (const key of result.keys) {
        imageCount += 1;
        estimatedBytes += key.size ?? 0;
      }
      cursor = result.list_complete ? undefined : (result.keys.at(-1)?.name ?? undefined);
    } while (cursor);
  } catch (error) {
    console.error("[upload] failed to estimate KV usage", error);
  }

  const warnLevel: KvUsageEstimate["warnLevel"] =
    estimatedBytes > KV_MAX_STORAGE_BYTES
      ? "exceeded"
      : estimatedBytes > KV_MAX_STORAGE_BYTES * KV_USAGE_WARN_THRESHOLD
        ? "approaching"
        : "ok";

  return { imageCount, estimatedBytes, warnLevel };
}

export async function saveProductImage(ns: KvLikeNamespace, file: File): Promise<UploadResult> {
  // Reject oversize before reading anything into memory.
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const buffer = await file.arrayBuffer();
  const detected = detectImageType(new Uint8Array(buffer));
  if (!detected) return { ok: false, reason: "unsupported" };

  // Best-effort storage guardrail check — warn if approaching KV free-tier
  // cap but never block the upload (best-effort logging only).
  try {
    const usage = await estimateKvUsage(ns);
    if (usage.warnLevel === "exceeded") {
      console.warn("[upload] KV storage estimate exceeded cap", {
        estimatedBytes: usage.estimatedBytes,
        cap: KV_MAX_STORAGE_BYTES,
      });
    } else if (usage.warnLevel === "approaching") {
      console.warn("[upload] KV storage estimate approaching cap", {
        estimatedBytes: usage.estimatedBytes,
        cap: KV_MAX_STORAGE_BYTES,
      });
    }
  } catch {
    // Estimation failure must never block upload
  }

  const key = `products/${crypto.randomUUID()}.${detected.ext}`;
  // Storage failures are an expected outcome of the typed union, not a crash:
  // convert the put rejection to storage_unavailable so callers answer with
  // the localized message instead of the request dying on an unhandled error.
  try {
    await ns.put(key, buffer);
  } catch (error) {
    // The typed union keeps callers simple; the raw cause goes to the logs so
    // a KV outage is diagnosable instead of a silent storage_unavailable.
    console.error("media put failed", error);
    return { ok: false, reason: "storage_unavailable" };
  }
  // Relative on purpose: images are served by the first-party /media/[...key]
  // route, so no public base URL exists anywhere in stored data.
  return { ok: true, url: `/media/${key}` };
}
