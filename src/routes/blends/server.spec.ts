import { describe, expect, it } from "vite-plus/test";
import { isRedirect } from "@sveltejs/kit";
import { GET } from "./+server";
import type { RequestEvent } from "./$types";

function eventFor(url: string): RequestEvent {
  return { url: new URL(url) } as RequestEvent;
}

async function expectRedirect(url: string): Promise<{ status: number; location: string }> {
  try {
    await GET(eventFor(url));
  } catch (error) {
    if (!isRedirect(error)) throw error;
    return { status: error.status, location: error.location };
  }
  throw new Error(`expected GET ${url} to redirect`);
}

describe("GET /blends", () => {
  it("redirects permanently to /honey", async () => {
    await expect(expectRedirect("https://example.com/blends")).resolves.toEqual({
      status: 301,
      location: "/honey",
    });
  });

  it("preserves the incoming query string", async () => {
    await expect(expectRedirect("https://example.com/blends?q=sidr&page=2")).resolves.toEqual({
      status: 301,
      location: "/honey?q=sidr&page=2",
    });
  });

  it("preserves duplicate keys and empty params", async () => {
    await expect(expectRedirect("https://example.com/blends?q=a&q=b&flag=")).resolves.toEqual({
      status: 301,
      location: "/honey?q=a&q=b&flag=",
    });
  });
});
