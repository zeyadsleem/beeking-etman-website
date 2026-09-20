import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { isRedirect } from "@sveltejs/kit";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import type { RequestEvent } from "./$types";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const state = vi.hoisted(() => ({
  database: null as LibSQLDatabase<typeof schema> | null,
}));

vi.mock("$lib/server/db", () => ({
  get db(): LibSQLDatabase<typeof schema> {
    if (!state.database) throw new Error("test database not initialized");
    return state.database;
  },
}));

import { GET } from "./+server";

const DB_FILE = "blends-redirect-test.db";

let client: ReturnType<typeof createClient> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!state.database) throw new Error("test database not initialized");
  return state.database;
}

async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  state.database = db;
  await db.run(`DROP TABLE IF EXISTS store_category`);
  await db.run(`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL DEFAULT 'honey', parent_id TEXT
    )`);
}

async function seedBlendsCategory(department = "honey"): Promise<void> {
  await currentDb().insert(schema.category).values({
    name: "خلطات جاهزة",
    nameEn: "Ready-made blends",
    slug: "blends",
    department,
  });
}

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

beforeEach(buildDb);
afterEach(() => vi.restoreAllMocks());

describe("GET /blends", () => {
  it("redirects permanently to /honey/blends when the category exists", async () => {
    await seedBlendsCategory();

    await expect(expectRedirect("https://example.com/blends")).resolves.toEqual({
      status: 301,
      location: "/honey/blends",
    });
  });

  it("falls back to /honey with a temporary redirect when the category does not exist", async () => {
    await expect(expectRedirect("https://example.com/blends")).resolves.toEqual({
      status: 302,
      location: "/honey",
    });
  });

  it("falls back to /honey when the category exists under another department", async () => {
    await seedBlendsCategory("equipment");

    await expect(expectRedirect("https://example.com/blends")).resolves.toEqual({
      status: 302,
      location: "/honey",
    });
  });

  it("preserves the incoming query string on the category target", async () => {
    await seedBlendsCategory();

    await expect(expectRedirect("https://example.com/blends?q=sidr&page=2")).resolves.toEqual({
      status: 301,
      location: "/honey/blends?q=sidr&page=2",
    });
  });

  it("preserves duplicate keys and empty params on the fallback target", async () => {
    await expect(expectRedirect("https://example.com/blends?q=a&q=b&flag=")).resolves.toEqual({
      status: 302,
      location: "/honey?q=a&q=b&flag=",
    });
  });

  it("falls back to /honey and logs when the lookup fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    state.database = null;

    await expect(expectRedirect("https://example.com/blends?q=sidr")).resolves.toEqual({
      status: 302,
      location: "/honey?q=sidr",
    });
    expect(errorLog).toHaveBeenCalledWith(
      "[blends] category lookup failed; falling back to /honey",
      expect.any(Error),
    );
  });
});

afterAll(() => {
  client?.close();
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
});
