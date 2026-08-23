import { describe, expect, it } from "vite-plus/test";

import { MAX_UPLOAD_BYTES, detectImageType, saveProductImage } from "./upload";

// Magic bytes verbatim from the spec: jpeg FF D8 FF, png 89 50 4E 47 0D 0A 1A
// 0A, webp "RIFF"???? "WEBP".
const JPEG_HEADER = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function asciiBytes(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

interface PutCall {
  key: string;
  value: ReadableStream | ArrayBuffer;
}

/** Fake R2 bucket capturing every put so tests assert keys and payloads. */
function makeBucket(): {
  put(key: string, value: ReadableStream | ArrayBuffer): Promise<unknown>;
  calls: PutCall[];
} {
  const calls: PutCall[] = [];
  return {
    calls,
    put(key, value) {
      calls.push({ key, value });
      return Promise.resolve(undefined);
    },
  };
}

function fileFrom(bytes: number[], name: string, type?: string): File {
  return new File([new Uint8Array(bytes)], name, type === undefined ? {} : { type });
}

describe("detectImageType", () => {
  it.each([
    {
      name: "jpeg header",
      input: [...JPEG_HEADER, 0xe0, 0x00, 0x10],
      expected: { ext: "jpg", mime: "image/jpeg" },
    },
    { name: "png signature", input: PNG_SIGNATURE, expected: { ext: "png", mime: "image/png" } },
    {
      name: "png payload after the signature",
      input: [...PNG_SIGNATURE, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48],
      expected: { ext: "png", mime: "image/png" },
    },
    {
      name: "webp riff container (size bytes ignored)",
      input: [...asciiBytes("RIFF"), 0x24, 0x0a, 0x00, 0x00, ...asciiBytes("WEBP"), 0x56, 0x50],
      expected: { ext: "webp", mime: "image/webp" },
    },
  ])("detects $name from magic bytes", ({ input, expected }) => {
    expect(detectImageType(new Uint8Array(input))).toEqual(expected);
  });

  it.each([
    { name: "empty input", input: [] },
    { name: "truncated jpeg", input: [0xff, 0xd8] },
    { name: "truncated png", input: [0x89, 0x50] },
    { name: "riff without the WEBP marker", input: [...asciiBytes("RIFF"), ...asciiBytes("JPGX")] },
    { name: "gif (unsupported family)", input: [...asciiBytes("GIF89a"), 0x00] },
    { name: "plain garbage", input: [0x00, 0x01, 0x02, 0x03] },
  ])("returns null for $name", ({ input }) => {
    expect(detectImageType(new Uint8Array(input))).toBeNull();
  });
});

describe("saveProductImage", () => {
  it("rejects an oversized file before reading or uploading anything", async () => {
    const bucket = makeBucket();
    // Valid jpeg header padded past the cap, so only the size check can fire.
    const file = new File(
      [new Uint8Array(JPEG_HEADER), new Uint8Array(MAX_UPLOAD_BYTES)],
      "big.jpg",
    );

    expect(file.size).toBe(MAX_UPLOAD_BYTES + JPEG_HEADER.length);
    await expect(saveProductImage(bucket, "https://media.example.com", file)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(bucket.calls).toHaveLength(0);
  });

  it("rejects non-image content declared as png with unsupported", async () => {
    const bucket = makeBucket();
    const file = new File([new TextEncoder().encode("definitely not an image")], "x.png", {
      type: "image/png",
    });

    await expect(saveProductImage(bucket, "https://media.example.com", file)).resolves.toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(bucket.calls).toHaveLength(0);
  });

  it("reports storage_unavailable and uploads nothing when publicBase is missing", async () => {
    const bucket = makeBucket();
    const file = fileFrom([...JPEG_HEADER, 0xe0], "honey.jpg", "image/jpeg");

    await expect(saveProductImage(bucket, undefined, file)).resolves.toEqual({
      ok: false,
      reason: "storage_unavailable",
    });
    expect(bucket.calls).toHaveLength(0);
  });

  it("stores a verified png under products/ with a uuid key and returns the joined URL", async () => {
    const bucket = makeBucket();
    const file = fileFrom(
      [...PNG_SIGNATURE, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52],
      "honey.png",
      "image/png",
    );

    const result = await saveProductImage(bucket, "https://media.example.com", file);

    expect(result).toEqual({ ok: true, url: expect.any(String) });
    if (!result.ok) return;
    const call = bucket.calls[0];
    expect(call).toBeDefined();
    if (!call || !(call.value instanceof ArrayBuffer)) return;
    expect(call.key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    expect(result.url).toBe(`https://media.example.com/${call.key}`);
    expect(new Uint8Array(call.value)).toEqual(new Uint8Array(await file.arrayBuffer()));
  });

  it("derives the extension only from the verified signature, not the filename", async () => {
    const bucket = makeBucket();
    // webp bytes smuggled in a .jpg-named file.
    const file = fileFrom(
      [...asciiBytes("RIFF"), 0x00, 0x00, 0x00, 0x00, ...asciiBytes("WEBP"), 0x56, 0x50, 0x38],
      "photo.jpg",
      "image/jpeg",
    );

    const result = await saveProductImage(bucket, "https://cdn.etman.test", file);

    expect(result.ok).toBe(true);
    const call = bucket.calls[0];
    expect(call?.key).toMatch(/^products\/[0-9a-f-]{36}\.webp$/);
    if (!result.ok) return;
    expect(result.url).toBe(`https://cdn.etman.test/${call?.key}`);
  });
});
