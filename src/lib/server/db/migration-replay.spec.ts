import { afterAll, describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

function dbFile(name: string): string {
  return `orders-migration-replay-${name}.db`;
}

function cleanDb(name: string): ReturnType<typeof createClient> {
  const file = dbFile(name);
  if (existsSync(file)) unlinkSync(file);
  return createClient({ url: `file:${file}` });
}

function migrationStatements(): string[] {
  const raw = readFileSync("drizzle/0016_order_hardening.sql", "utf-8");
  return raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => {
      if (s.length === 0) return false;
      const hasSql = s.split("\n").some((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith("--");
      });
      return hasSql;
    });
}

async function apply0016(db: ReturnType<typeof drizzle>): Promise<void> {
  for (const statement of migrationStatements()) {
    await db.run(sql.raw(statement));
  }
}

async function applyStaged(client: ReturnType<typeof createClient>, path: string): Promise<void> {
  const raw = readFileSync(path, "utf-8");
  for (const statement of raw.split("--> statement-breakpoint")) {
    const text = statement.trim();
    if (text) await client.execute(text);
  }
}

async function applyMigrationFile(db: ReturnType<typeof drizzle>, path: string): Promise<void> {
  for (const statement of migrationFileStatements(path)) {
    await db.run(sql.raw(statement));
  }
}

function migrationFileStatements(path: string): string[] {
  return readFileSync(path, "utf-8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.split("\n").some((line) => line.trim().length > 0));
}

async function seedPre0018Outbox(db: ReturnType<typeof drizzle>): Promise<void> {
  await db.run(sql`
    CREATE TABLE store_notification (
      id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'email', recipient TEXT NOT NULL,
      subject TEXT NOT NULL, body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL, sent_at INTEGER
    )
  `);
  await db.run(sql`
    INSERT INTO store_notification (id, type, channel, recipient, subject, body, status, created_at)
    VALUES ('n1', 'order_received', 'email', 'a@example.com', 's', '{}', 'pending', 1111)
  `);
  await db.run(sql`
    INSERT INTO store_notification (id, type, channel, recipient, subject, body, status, created_at, sent_at)
    VALUES ('n2', 'order_received', 'email', 'b@example.com', 's', '{}', 'sent', 2222, 3333)
  `);
}

function productColumns(client: Client): Promise<Set<string>> {
  return client
    .execute("PRAGMA table_info(store_product)")
    .then((r) => new Set(r.rows.map((c) => String(c.name))));
}

async function seedPre0016Schema(db: ReturnType<typeof drizzle>): Promise<void> {
  await db.run(sql`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL DEFAULT 'honey', parent_id TEXT
    )
  `);
  await db.run(sql`
    CREATE TABLE store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      description_en TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      category_id TEXT NOT NULL, department TEXT NOT NULL DEFAULT 'honey', featured INTEGER NOT NULL DEFAULT 0, sku TEXT, published INTEGER NOT NULL DEFAULT 1, cost_price INTEGER, weight_grams INTEGER,
      created_at INTEGER NOT NULL
    )
  `);
  await db.run(sql`
    CREATE TABLE store_product_variant (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.run(sql`
    CREATE TABLE store_product_image (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL REFERENCES store_product(id),
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.run(sql`
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      nonce TEXT UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, governorate TEXT NOT NULL DEFAULT 'cairo', shipping_cost INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid', user_id TEXT, created_at INTEGER NOT NULL
    )
  `);
  await db.run(sql`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES store_order(id),
      product_id TEXT NOT NULL REFERENCES store_product(id),
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )
  `);
}

describe("0016_order_hardening migration replay", () => {
  it("applies to a pre-0016 schema and creates version-gated triggers and indexes", async () => {
    const client = cleanDb("baseline");
    const db = drizzle(client, { schema });

    await seedPre0016Schema(db);
    await apply0016(db);

    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'store_%'",
    );
    const tableNames = new Set(tables.map((t) => (t as { name: string }).name));
    expect(tableNames.has("store_order")).toBe(true);
    expect(tableNames.has("store_order_item")).toBe(true);

    const indexes = await db.all(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'store_order_item_orderId_idx'",
    );
    expect(indexes).toHaveLength(1);
    expect((indexes[0] as { sql: string }).sql).toContain("store_order_item");

    const triggers = await db.all("SELECT name FROM sqlite_master WHERE type = 'trigger'");
    const triggerNames = new Set(triggers.map((t) => (t as { name: string }).name));
    expect(triggerNames.has("trg_order_item_reserve_stock")).toBe(true);
    expect(triggerNames.has("trg_order_status_cancel_restock")).toBe(true);
    expect(triggerNames.has("trg_product_variant_stock_non_negative")).toBe(true);

    const orderColumns = await db.all("PRAGMA table_info(store_order)");
    const columnNames = new Set(orderColumns.map((c) => (c as { name: string }).name));
    expect(columnNames.has("payment_status")).toBe(true);
    expect(columnNames.has("stock_version")).toBe(true);

    const reserveTrigger = (
      await db.all(
        "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_order_item_reserve_stock'",
      )
    )[0] as { sql: string };
    expect(reserveTrigger.sql).toContain("stock_version");
    expect(reserveTrigger.sql).toContain("'atomic'");

    client.close();
  });

  it("upgrades a legacy fixture with paid orders without rewriting their status", async () => {
    const client = cleanDb("legacy");
    const db = drizzle(client, { schema });

    await seedPre0016Schema(db);

    const orderId = randomUUID();
    const createdAt = Date.now();
    await db.run(
      sql`INSERT INTO store_order (id, number, email, name, phone, address, city, total, status, created_at)
          VALUES (${orderId}, 'HNY-LEGACY', 'a@example.com', 'أحمد', '01012345678', 'شارع 9', 'القاهرة', 10000, 'paid', ${createdAt})`,
    );

    await apply0016(db);

    const row = await db
      .select({ status: schema.order.status, stockVersion: schema.order.stockVersion })
      .from(schema.order)
      .where(eq(schema.order.id, orderId))
      .get();
    expect(row?.status).toBe("paid");
    expect(row?.stockVersion).toBe("legacy");

    client.close();
  });
});

describe("0018_email_delivery migration replay", () => {
  it("rebuilds the outbox with delivery columns, CHECK, indexes, and terminal backfill", async () => {
    const client = cleanDb("email");
    const db = drizzle(client, { schema });

    await seedPre0018Outbox(db);
    await applyMigrationFile(db, "drizzle/0018_email_delivery.sql");

    const columns = new Set(
      (await db.all("PRAGMA table_info(store_notification)")).map(
        (c) => (c as { name: string }).name,
      ),
    );
    for (const name of [
      "from_address",
      "attempt_count",
      "next_attempt_at",
      "last_error",
      "provider_message_id",
      "locked_at",
      "idempotency_key",
    ]) {
      expect(columns.has(name)).toBe(true);
    }

    const rows = await db.all(
      "SELECT id, status, attempt_count, next_attempt_at, provider_message_id, locked_at, from_address FROM store_notification ORDER BY id",
    );
    expect(rows[0]).toMatchObject({
      id: "n1",
      status: "sent",
      attempt_count: 0,
      next_attempt_at: 1111,
      provider_message_id: null,
      locked_at: null,
      from_address: "",
    });
    expect(rows[1]).toMatchObject({ id: "n2", status: "sent", next_attempt_at: 2222 });

    const indexes = new Set(
      (
        await db.all(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'store_notification_%'",
        )
      ).map((i) => (i as { name: string }).name),
    );
    for (const name of [
      "store_notification_type_idx",
      "store_notification_due_idx",
      "store_notification_created_idx",
      "store_notification_idem_idx",
    ]) {
      expect(indexes.has(name)).toBe(true);
    }

    await expect(
      db.run(sql`INSERT INTO store_notification (id, type, recipient, subject, body, status, created_at)
                 VALUES ('bad', 't', 'r', 's', '{}', 'bogus', 1)`),
    ).rejects.toThrow();

    await db.run(sql`INSERT INTO store_notification (id, type, recipient, subject, body, created_at, idempotency_key)
                     VALUES ('n3', 't', 'r', 's', '{}', 1, 'key-1')`);
    await db.run(sql`INSERT INTO store_notification (id, type, recipient, subject, body, created_at, idempotency_key)
                     VALUES ('n4', 't', 'r', 's', '{}', 1, NULL)`);
    await db.run(sql`INSERT INTO store_notification (id, type, recipient, subject, body, created_at, idempotency_key)
                     VALUES ('n5', 't', 'r', 's', '{}', 1, NULL)`);
    await expect(
      db.run(sql`INSERT INTO store_notification (id, type, recipient, subject, body, created_at, idempotency_key)
                 VALUES ('n6', 't', 'r', 's', '{}', 1, 'key-1')`),
    ).rejects.toThrow();

    client.close();
  });
});

describe("0019_settlement migration replay", () => {
  it("rebuilds store_order, recreates triggers, and enforces the settlement vocabulary", async () => {
    const client = cleanDb("settlement");
    const db = drizzle(client, { schema });

    await seedPre0016Schema(db);
    await apply0016(db);
    await applyMigrationFile(db, "drizzle/0019_settlement.sql");

    const orderColumns = new Set(
      (await db.all("PRAGMA table_info(store_order)")).map((c) => (c as { name: string }).name),
    );
    for (const name of [
      "payment_method",
      "payment_reference",
      "payment_claimed_at",
      "payment_reviewed_at",
      "payment_reviewed_by",
      "hold_expires_at",
      "paid_at",
    ]) {
      expect(orderColumns.has(name)).toBe(true);
    }

    const tables = new Set(
      (await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")).map(
        (t) => (t as { name: string }).name,
      ),
    );
    expect(tables.has("store_payment_event")).toBe(true);

    const triggers = new Set(
      (await db.all("SELECT name FROM sqlite_master WHERE type = 'trigger'")).map(
        (t) => (t as { name: string }).name,
      ),
    );
    expect(triggers.has("trg_order_item_reserve_stock")).toBe(true);
    expect(triggers.has("trg_order_status_cancel_restock")).toBe(true);
    expect(triggers.has("trg_order_settlement_values_valid")).toBe(true);
    expect(triggers.has("trg_order_settlement_values_valid_update")).toBe(true);

    const indexes = await db.all(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name IN ('store_order_hold_idx','store_payment_event_orderId_createdAt_idx')",
    );
    expect(indexes).toHaveLength(2);
    const hold = indexes.find((i) => (i as { name: string }).name === "store_order_hold_idx") as {
      sql: string;
    };
    expect(hold.sql).toContain("WHERE");

    const legacyId = randomUUID();
    await db.run(
      sql`INSERT INTO store_order (id, number, email, name, phone, address, city, total, status, payment_status, stock_version, created_at)
          VALUES (${legacyId}, 'HNY-LEGACY-19', 'a@example.com', 'أحمد', '01012345678', 'شارع 9', 'القاهرة', 10000, 'placed', 'simulated', 'legacy', 1)`,
    );
    const defaultsId = randomUUID();
    await db.run(
      sql`INSERT INTO store_order (id, number, email, name, phone, address, city, total, created_at)
          VALUES (${defaultsId}, 'HNY-NEW-19', 'b@example.com', 'سارة', '01098765432', 'شارع 4', 'الجيزة', 20000, 2)`,
    );

    const rows = await db.all(
      "SELECT id, status, payment_status, payment_method, hold_expires_at FROM store_order ORDER BY created_at",
    );
    expect(rows[0]).toMatchObject({
      id: legacyId,
      status: "placed",
      payment_status: "simulated",
      payment_method: "simulated",
      hold_expires_at: null,
    });
    expect(rows[1]).toMatchObject({
      id: defaultsId,
      status: "pending_confirmation",
      payment_status: "unpaid",
      payment_method: "simulated",
      hold_expires_at: null,
    });

    await expect(
      db.run(
        sql`INSERT INTO store_order (id, number, email, name, phone, address, city, total, status, created_at)
            VALUES ('bad-status', 'HNY-BAD-1', 'c@e.com', 'x', '1', 's', 'cairo', 1, 'bogus', 3)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.run(
        sql`INSERT INTO store_order (id, number, email, name, phone, address, city, total, stock_version, created_at)
            VALUES ('bad-stock', 'HNY-BAD-2', 'c@e.com', 'x', '1', 's', 'cairo', 1, 'nonsense', 4)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.run(sql`UPDATE store_order SET payment_status = 'bogus' WHERE id = ${defaultsId}`),
    ).rejects.toThrow();

    const productId = randomUUID();
    const variantId = randomUUID();
    await db.run(
      sql`INSERT INTO store_product (id, name, slug, description, price, image, category_id, created_at)
          VALUES (${productId}, 'عسل سدر', 'sidr-replay', 'أفضل عسل', 100, '', 'cat-1', 1)`,
    );
    await db.run(
      sql`INSERT INTO store_product_variant (id, product_id, name, price, stock, image)
          VALUES (${variantId}, ${productId}, '1 ك', 100, 10, '')`,
    );

    const stockOf = async (): Promise<number> =>
      (
        (await db.all(sql`SELECT stock FROM store_product_variant WHERE id = ${variantId}`)) as {
          stock: number;
        }[]
      )[0].stock;

    const shippedId = randomUUID();
    await db.run(
      sql`INSERT INTO store_order (id, number, email, name, phone, address, city, total, status, payment_status, stock_version, created_at)
          VALUES (${shippedId}, 'HNY-SHIP-19', 'd@e.com', 'x', '1', 's', 'cairo', 1, 'pending_confirmation', 'unpaid', 'atomic', 5)`,
    );
    await db.run(
      sql`INSERT INTO store_order_item (id, order_id, product_id, variant_id, product_name, variant_name, quantity, unit_price)
          VALUES (${randomUUID()}, ${shippedId}, ${productId}, ${variantId}, 'عسل سدر', '1 ك', 2, 100)`,
    );
    expect(await stockOf()).toBe(8);
    await db.run(sql`UPDATE store_order SET status = 'confirmed' WHERE id = ${shippedId}`);
    await db.run(sql`UPDATE store_order SET status = 'shipped' WHERE id = ${shippedId}`);
    await db.run(sql`UPDATE store_order SET status = 'cancelled' WHERE id = ${shippedId}`);
    expect(await stockOf()).toBe(8);

    const pendingId = randomUUID();
    await db.run(
      sql`INSERT INTO store_order (id, number, email, name, phone, address, city, total, status, payment_status, stock_version, created_at)
          VALUES (${pendingId}, 'HNY-PEND-19', 'e@e.com', 'x', '1', 's', 'cairo', 1, 'pending_confirmation', 'unpaid', 'atomic', 6)`,
    );
    await db.run(
      sql`INSERT INTO store_order_item (id, order_id, product_id, variant_id, product_name, variant_name, quantity, unit_price)
          VALUES (${randomUUID()}, ${pendingId}, ${productId}, ${variantId}, 'عسل سدر', '1 ك', 3, 100)`,
    );
    expect(await stockOf()).toBe(5);
    await db.run(sql`UPDATE store_order SET status = 'cancelled' WHERE id = ${pendingId}`);
    expect(await stockOf()).toBe(8);
    await db.run(sql`UPDATE store_order SET status = 'cancelled' WHERE id = ${pendingId}`);
    expect(await stockOf()).toBe(8);

    client.close();
  }, 30_000);
});

describe("staged legacy column drop", () => {
  it("staging guard: the final drop is not in the drizzle journal while the bridge is", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf-8")) as {
      entries: { tag: string }[];
    };
    const tags = journal.entries.map((e) => e.tag);
    expect(tags).toContain("0017_catalog_authority");
    expect(tags).not.toContain("0017_drop_legacy_product_columns");
  });

  it("bridge keeps old-app cover writes reaching the gallery before the final drop", async () => {
    const client = cleanDb("staged");
    const db = drizzle(client, { schema });

    await seedPre0016Schema(db);
    await apply0016(db);
    await applyStaged(client, "drizzle/0017_catalog_authority.sql");
    await applyStaged(client, "drizzle/staged/0017_drop_legacy_product_columns.sql");

    const after = await productColumns(client);
    expect(after.has("price")).toBe(false);
    expect(after.has("stock")).toBe(false);
    expect(after.has("image")).toBe(false);

    const triggers = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'store_product_legacy%'",
    );
    expect(triggers.rows).toHaveLength(0);

    const categoryId = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();
    await client.execute(
      `INSERT INTO store_category (id, name, slug) VALUES ('${categoryId}', 'عسل', 'honey')`,
    );
    await client.execute(
      `INSERT INTO store_product (id, name, slug, description, category_id, created_at)
       VALUES ('${productId}', 'عسل سدر', 'sidr', 'أفضل عسل', '${categoryId}', ${Date.now()})`,
    );
    await client.execute(
      `INSERT INTO store_product_variant (id, product_id, name, price, stock, image)
       VALUES ('${variantId}', '${productId}', '1 ك', 100, 1, '')`,
    );
    const variant = await client.execute(
      `SELECT price FROM store_product_variant WHERE id = '${variantId}'`,
    );
    expect(variant.rows[0]?.price).toBe(100);

    client.close();
  });

  afterAll(() => {
    for (const name of ["baseline", "legacy", "staged", "email", "settlement"]) {
      const file = dbFile(name);
      if (existsSync(file)) unlinkSync(file);
    }
  });
});
