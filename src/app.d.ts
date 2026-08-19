import type { User, Session } from "better-auth";

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Minimal structural view of Cloudflare's D1Database (the shape Drizzle's D1
// driver exercises). Kept local so the full @cloudflare/workers-types globals
// don't leak into client code (they override e.g. Response.json()).
interface D1Result {
  results?: unknown[];
  success: boolean;
  meta: unknown;
  error?: unknown;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result>;
  all<T = unknown>(): Promise<{ results?: T[]; success: boolean; meta: unknown }>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch<T extends readonly unknown[]>(statements: T): Promise<unknown[]>;
  dump(): Promise<ArrayBuffer>;
}

declare global {
  namespace App {
    interface Locals {
      user?: User;
      session?: Session;
    }

    // interface Error {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: {
        DB: D1Database;
      };
    }
  }
}

export {};
