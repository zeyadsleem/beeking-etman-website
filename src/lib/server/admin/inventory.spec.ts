import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { recordConversion } from "./inventory";

let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle<typeof schema>>;
const input = {
  batchId: "batch",
  variantId: "variant",
  rawKgsUsed: 2,
  unitsProduced: 4,
  materialId: "material",
  materialUnits: 4,
};

beforeEach(async () => {
  client = createClient({ url: "file::memory:" });
  db = drizzle(client, { schema });
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE store_batch (id TEXT PRIMARY KEY, quantity_kg REAL NOT NULL);
    CREATE TABLE store_product_variant (id TEXT PRIMARY KEY, stock INTEGER NOT NULL);
    CREATE TABLE store_packaging_material (id TEXT PRIMARY KEY, stock_quantity INTEGER NOT NULL);
    CREATE TABLE store_stock_conversion (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES store_batch(id), variant_id TEXT NOT NULL REFERENCES store_product_variant(id), raw_kgs_used REAL NOT NULL, units_produced INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE store_stock_movement (id TEXT PRIMARY KEY, type TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, warehouse_id TEXT, quantity INTEGER NOT NULL, ref_id TEXT, notes TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE store_admin_audit (id TEXT PRIMARY KEY, admin_user_id TEXT, action TEXT, target_type TEXT, target_id TEXT, details TEXT, created_at INTEGER);
    INSERT INTO store_batch VALUES ('batch', 10);
    INSERT INTO store_product_variant VALUES ('variant', 0);
    INSERT INTO store_packaging_material VALUES ('material', 4);
  `);
});

afterEach(() => {
  vi.restoreAllMocks();
  client.close();
});

async function balances() {
  return {
    raw: (await client.execute("SELECT quantity_kg FROM store_batch")).rows[0]?.quantity_kg,
    units: (await client.execute("SELECT stock FROM store_product_variant")).rows[0]?.stock,
    material: (await client.execute("SELECT stock_quantity FROM store_packaging_material")).rows[0]
      ?.stock_quantity,
    conversions: (await client.execute("SELECT count(*) AS count FROM store_stock_conversion"))
      .rows[0]?.count,
    movements: (await client.execute("SELECT count(*) AS count FROM store_stock_movement")).rows[0]
      ?.count,
  };
}

describe("recordConversion atomicity", () => {
  it("records every stock delta in the conversion ledger", async () => {
    const result = await recordConversion(db, input);
    expect(result.ok).toBe(true);
    expect(await balances()).toEqual({
      raw: 8,
      units: 4,
      material: 0,
      conversions: 1,
      movements: 3,
    });
    const movements = await db.select().from(schema.stockMovement);
    expect(
      movements
        .sort((left, right) => left.itemType.localeCompare(right.itemType))
        .map((row) => [row.itemType, row.quantity]),
    ).toEqual([
      ["batch", -2000],
      ["material", -4],
      ["variant", 4],
    ]);
    expect(new Set(movements.map((row) => row.refId))).toEqual(
      new Set([result.ok ? result.id : null]),
    );
  });

  it.each(["raw", "material"] as const)(
    "rejects insufficient %s without changing inventory",
    async (kind) => {
      await client.execute(
        kind === "raw"
          ? "UPDATE store_batch SET quantity_kg = 1"
          : "UPDATE store_packaging_material SET stock_quantity = 1",
      );
      const before = await balances();
      expect(await recordConversion(db, input)).toEqual({
        ok: false,
        reason: kind === "raw" ? "notEnoughRaw" : "notEnoughMaterial",
      });
      expect(await balances()).toEqual(before);
    },
  );

  it.each(["raw", "material"] as const)(
    "rolls back when %s is spent after preflight",
    async (kind) => {
      const batch = db.batch.bind(db);
      vi.spyOn(db, "batch").mockImplementationOnce(async (statements) => {
        await client.execute(
          kind === "raw"
            ? "UPDATE store_batch SET quantity_kg = 1"
            : "UPDATE store_packaging_material SET stock_quantity = 1",
        );
        return batch(statements);
      });
      expect(await recordConversion(db, input)).toEqual({
        ok: false,
        reason: kind === "raw" ? "notEnoughRaw" : "notEnoughMaterial",
      });
      expect(await balances()).toEqual({
        raw: kind === "raw" ? 1 : 10,
        units: 0,
        material: kind === "material" ? 1 : 4,
        conversions: 0,
        movements: 0,
      });
    },
  );

  it("rolls back stock and conversion when a ledger insert fails", async () => {
    await client.execute(
      "CREATE TRIGGER reject_movement BEFORE INSERT ON store_stock_movement WHEN NEW.item_type = 'variant' BEGIN SELECT RAISE(ABORT, 'ledger unavailable'); END",
    );
    const before = await balances();
    await expect(recordConversion(db, input)).rejects.toThrow();
    expect(await balances()).toEqual(before);
  });

  it.each(["raw", "material"] as const)(
    "allows only one competing conversion to spend %s",
    async (kind) => {
      await client.execute(
        kind === "raw"
          ? "UPDATE store_batch SET quantity_kg = 2"
          : "UPDATE store_batch SET quantity_kg = 10",
      );
      if (kind === "raw")
        await client.execute("UPDATE store_packaging_material SET stock_quantity = 8");
      const batch = db.batch.bind(db);
      let arrivals = 0;
      let release = () => {};
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(db, "batch").mockImplementation(async (statements) => {
        arrivals += 1;
        if (arrivals === 2) release();
        await ready;
        return batch(statements);
      });
      const results = await Promise.all([recordConversion(db, input), recordConversion(db, input)]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results).toContainEqual({
        ok: false,
        reason: kind === "raw" ? "notEnoughRaw" : "notEnoughMaterial",
      });
      expect(await balances()).toEqual({
        raw: kind === "raw" ? 0 : 8,
        units: 4,
        material: kind === "raw" ? 4 : 0,
        conversions: 1,
        movements: 3,
      });
    },
  );

  it("rolls back when material is deleted after preflight", async () => {
    const batch = db.batch.bind(db);
    vi.spyOn(db, "batch").mockImplementationOnce(async (statements) => {
      await client.execute("DELETE FROM store_packaging_material");
      return batch(statements);
    });
    expect(await recordConversion(db, input)).toEqual({ ok: false, reason: "materialNotFound" });
    expect(await balances()).toEqual({
      raw: 10,
      units: 0,
      material: undefined,
      conversions: 0,
      movements: 0,
    });
  });

  it("converts without optional material", async () => {
    expect(
      (
        await recordConversion(db, {
          batchId: "batch",
          variantId: "variant",
          rawKgsUsed: 2,
          unitsProduced: 4,
        })
      ).ok,
    ).toBe(true);
    expect(await balances()).toEqual({
      raw: 8,
      units: 4,
      material: 4,
      conversions: 1,
      movements: 2,
    });
  });
});
