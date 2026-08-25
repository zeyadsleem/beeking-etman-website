import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { RequestEvent } from "@sveltejs/kit";

import type { KvLikeNamespace } from "$lib/server/admin/upload";

// The route module (and its generated $types) only exists once implemented;
// importing it in beforeAll mirrors the sibling page specs.
type GetHandler = (event: RequestEvent) => Promise<Response>;

let GET: GetHandler;

beforeAll(async () => {
  const module = await import("./+server");
  GET = module.GET as unknown as GetHandler;
});

const UUID = crypto.randomUUID();

/** Minimal structural view of the edge Cache API surface the route may use. */
interface FakeEdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/**
 * Fake caches.default backed by a url-keyed map, with call counters so tests
 * can assert exactly when the edge cache is consulted or filled.
 */
function makeCache(): FakeEdgeCache & {
  store: Map<string, Response>;
  stats: { matches: number; puts: number };
} {
  const store = new Map<string, Response>();
  const stats = { matches: 0, puts: 0 };
  return {
    store,
    stats,
    async match(request) {
      stats.matches += 1;
      const hit = store.get(request.url);
      return hit === undefined ? undefined : hit.clone();
    },
    async put(request, response) {
      stats.puts += 1;
      store.set(request.url, response.clone());
    },
  };
}

function makeMedia(value: ArrayBuffer | null): KvLikeNamespace & { gets: string[] } {
  const gets: string[] = [];
  return {
    gets,
    get(key: string, _options: { type: "arrayBuffer" }): Promise<ArrayBuffer | null> {
      gets.push(key);
      return Promise.resolve(value);
    },
    put(): Promise<void> {
      return Promise.reject(new Error("the media route never writes to kv"));
    },
  };
}

/** Cache whose background fills always reject, driving the failure path. */
function makeCacheWithFailingFill(): FakeEdgeCache & { stats: { matches: number; puts: number } } {
  const cache = makeCache();
  return {
    match: (request) => cache.match(request),
    async put(): Promise<void> {
      cache.stats.puts += 1;
      return Promise.reject(new Error("edge cache unavailable"));
    },
    stats: cache.stats,
  };
}

// vitest/node has no `caches` global; tests install a fake explicitly and
// restore whatever was there so sibling spec files are unaffected.
const ORIGINAL_CACHES = Object.getOwnPropertyDescriptor(globalThis, "caches");

function installCaches(fake: FakeEdgeCache): void {
  // The runtime surface is caches.default; the fake replaces the whole
  // CacheStorage holder.
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: fake } });
}

afterEach(() => {
  if (ORIGINAL_CACHES === undefined) {
    delete (globalThis as { caches?: unknown }).caches;
  } else {
    Object.defineProperty(globalThis, "caches", ORIGINAL_CACHES);
  }
});

interface MediaEvent {
  event: RequestEvent;
  /** Promises handed to waitUntil — tests await them to observe cache fills. */
  deferred: Array<Promise<unknown>>;
}

function mediaEvent(key: string, media: KvLikeNamespace | undefined): MediaEvent {
  const deferred: Array<Promise<unknown>> = [];
  const event = {
    params: { key },
    request: new Request(`https://store.example/media/${key}`),
    ...(media === undefined
      ? {}
      : {
          platform: {
            env: { MEDIA: media },
            ctx: {
              waitUntil: (promise: Promise<unknown>): void => {
                deferred.push(promise);
              },
            },
          },
        }),
  } as unknown as RequestEvent;
  return { event, deferred };
}

describe("GET /media/[...key]", () => {
  it.each([
    { label: "an empty key", key: "" },
    { label: "a foreign folder", key: `other/${UUID}.png` },
    { label: "a non-uuid filename", key: "products/not-a-uuid.png" },
    { label: "an unsupported extension", key: `products/${UUID}.gif` },
    { label: "an uppercase extension", key: `products/${UUID}.PNG` },
    { label: "a non-hex leading character", key: `products/${"-".repeat(36)}.png` },
    { label: "an uppercase hex filename", key: `products/${UUID.toUpperCase()}.png` },
    { label: "a traversal attempt", key: `../secrets/products/${UUID}.png` },
    { label: "a second path segment smuggle", key: `products/${UUID}/extra.png` },
  ])("404s on $label without touching kv or the edge cache", async ({ key }) => {
    const media = makeMedia(new ArrayBuffer(8));
    const cache = makeCache();
    installCaches(cache);
    const { event, deferred } = mediaEvent(key, media);

    const response = await GET(event);

    expect(response.status).toBe(404);
    expect(media.gets).toHaveLength(0);
    expect(cache.stats.puts).toBe(0);
    expect(deferred).toHaveLength(0);
  });

  it("404s uniformly when the MEDIA binding is missing", async () => {
    const { event, deferred } = mediaEvent(`products/${UUID}.png`, undefined);

    const response = await GET(event);

    expect(response.status).toBe(404);
    expect(deferred).toHaveLength(0);
  });

  it("404s when kv holds no value for an otherwise valid key", async () => {
    const media = makeMedia(null);
    const { event } = mediaEvent(`products/${UUID}.png`, media);

    const response = await GET(event);

    expect(response.status).toBe(404);
    expect(media.gets).toEqual([`products/${UUID}.png`]);
  });

  it.each([
    { ext: "jpg", contentType: "image/jpeg" },
    { ext: "png", contentType: "image/png" },
    { ext: "webp", contentType: "image/webp" },
  ])(
    "serves kv bytes for .$ext with $contentType and immutable caching",
    async ({ ext, contentType }) => {
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]).buffer;
      const media = makeMedia(bytes);
      const { event, deferred } = mediaEvent(`products/${UUID}.${ext}`, media);

      const response = await GET(event);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(contentType);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
      expect(response.headers.get("Content-Length")).toBe(String(bytes.byteLength));
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes));
      expect(media.gets).toEqual([`products/${UUID}.${ext}`]);
      // No caches.default in node/vitest: nothing is scheduled.
      expect(deferred).toHaveLength(0);
    },
  );

  it("fills the edge cache via waitUntil after a kv read when caches.default exists", async () => {
    const cache = makeCache();
    installCaches(cache);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
    const media = makeMedia(bytes);
    const { event, deferred } = mediaEvent(`products/${UUID}.jpg`, media);

    const response = await GET(event);

    expect(response.status).toBe(200);
    expect(cache.stats.matches).toBe(1);
    await Promise.all(deferred);
    expect(cache.stats.puts).toBe(1);
    const cachedResponse = cache.store.get(`https://store.example/media/products/${UUID}.jpg`);
    expect(cachedResponse).toBeDefined();
    expect(cachedResponse?.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("returns an edge-cache hit without reading kv and schedules no put", async () => {
    const cache = makeCache();
    installCaches(cache);
    const hitUrl = `https://store.example/media/products/${UUID}.webp`;
    const cachedBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    cache.store.set(
      hitUrl,
      new Response(cachedBytes, { headers: { "Content-Type": "image/webp" } }),
    );
    const media = makeMedia(null);
    const { event, deferred } = mediaEvent(`products/${UUID}.webp`, media);

    const response = await GET(event);

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(cachedBytes);
    expect(media.gets).toHaveLength(0);
    expect(deferred).toHaveLength(0);
  });

  it("serves the kv bytes even when the edge-cache background fill rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cache = makeCacheWithFailingFill();
    installCaches(cache);
    const bytes = new Uint8Array([0x89, 0x50]).buffer;
    const media = makeMedia(bytes);
    const { event, deferred } = mediaEvent(`products/${UUID}.png`, media);

    const response = await GET(event);

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes));
    // The fill was attempted exactly once and its rejection was absorbed:
    // awaiting it resolves (logged) instead of surfacing as an unhandled error.
    expect(cache.stats.puts).toBe(1);
    await Promise.all(deferred);
    expect(errorSpy).toHaveBeenCalledWith("media cache put failed", expect.any(Error));
  });
});
