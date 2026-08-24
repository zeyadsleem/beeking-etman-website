/**
 * Public read-only view over the MEDIA KV namespace for product images.
 * Keys are strictly pattern-checked before any storage access so the endpoint
 * can never act as an open read proxy over the namespace; only the
 * admin-uploaded products/<uuid>.<ext> shape qualifies. Responses are
 * immutable (fresh UUID keys are never rewritten) and edge-cached first.
 */
import type { RequestHandler } from "./$types";

const MEDIA_KEY_PATTERN = /^products\/[0-9a-f][0-9a-f-]{35}\.(jpg|png|webp)$/;

/** Minimal structural view of the edge Cache API surface used here; kept
 * local (instead of DOM/workers-types) so the global surface stays as narrow
 * as the app.d.ts bindings philosophy. Optional chaining over
 * `globalThis.caches` keeps the route unit-testable where it is absent. */
interface MediaEdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function edgeCache(): MediaEdgeCache | undefined {
  const caches = (globalThis as { caches?: { default?: MediaEdgeCache } }).caches;
  return caches?.default;
}

/** Content type derives ONLY from the validated URL extension, never from
 * stored metadata; an unknown mapping degrades to the uniform 404 below. */
function contentTypeFor(ext: string): string | undefined {
  switch (ext) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return undefined;
  }
}

function mediaNotFound(): Response {
  return new Response("not found", { status: 404 });
}

export const GET: RequestHandler = async (event) => {
  const key = event.params.key ?? "";
  const validated = MEDIA_KEY_PATTERN.exec(key);
  const ext = validated?.[1];
  if (!validated || ext === undefined || contentTypeFor(ext) === undefined) return mediaNotFound();

  const request = event.request;
  const cache = edgeCache();
  if (cache !== undefined) {
    const cached = await cache.match(request);
    if (cached !== undefined) return cached;
  }

  // A missing binding (no platform) and a missing value both degrade to the
  // same uniform 404 — neither leaks which part is absent.
  const value = (await event.platform?.env.MEDIA.get(key, { type: "arrayBuffer" })) ?? null;
  if (value === null) return mediaNotFound();

  const contentType = contentTypeFor(ext);
  if (contentType === undefined) return mediaNotFound();

  const response = new Response(value, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(value.byteLength),
    },
  });

  // Background-fill rides the Pages ExecutionContext (platform.ctx); where
  // either the edge cache or a waitUntil surface is absent — e.g. under unit
  // tests — the route simply serves uncached. The fill is best-effort: a
  // rejecting (or synchronously throwing) put is logged and swallowed so it
  // can never surface as an unhandled error after the response was returned.
  const ctx = event.platform?.ctx;
  if (cache !== undefined && ctx !== undefined) {
    try {
      const fill = cache
        .put(request, response.clone())
        .catch((error: unknown) => console.error("media cache put failed", error));
      ctx.waitUntil(fill);
    } catch (error) {
      console.error("media cache put failed", error);
    }
  }
  return response;
};
