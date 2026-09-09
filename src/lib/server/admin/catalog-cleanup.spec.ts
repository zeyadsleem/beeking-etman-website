import { afterEach, describe, expect, it } from "vite-plus/test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFileSync, readdirSync } from "node:fs";
import * as schema from "$lib/server/db/schema";
import { getProductWithVariants, getSearchSuggestions } from "$lib/server/store";
import { listAdminProducts, productInputSchema } from "./products";
import { listProductImages, setCoverUrl } from "./product-images";
import { applyProductForm } from "./product-form";

const clients: ReturnType<typeof createClient>[] = [];

async function database() {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  for (const file of readdirSync("drizzle")
    .filter((file) => /^\d{4}.*\.sql$/.test(file))
    .sort()) {
    if (file.startsWith("0017")) continue;
    for (const statement of readFileSync(`drizzle/${file}`, "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (statement.trim()) await client.execute(statement);
    }
  }
  const db = drizzle(client, { schema });
  await db.insert(schema.category).values({ id: "c", name: "Honey", slug: "honey" });
  await db.insert(schema.product).values({
    id: "p",
    name: "Honey",
    slug: "honey",
    description: "Honey",
    categoryId: "c",
    price: 99999,
    stock: 91,
    image: "/legacy.png",
  });
  await db
    .insert(schema.productVariant)
    .values({ id: "v", productId: "p", name: "Jar", price: 1200, stock: 7, image: "/variant.png" });
  return { db, client };
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

describe("catalog authority", () => {
  it("takes admin price and stock exclusively from variants", async () => {
    const { db } = await database();
    expect((await listAdminProducts(db)).items[0]).toMatchObject({ price: 1200, totalStock: 7 });
  });

  it("uses the ordered gallery cover for storefront and suggestions", async () => {
    const { db } = await database();
    await db
      .insert(schema.productImage)
      .values({ productId: "p", url: "/gallery.png", sortOrder: 0 });
    expect(await getProductWithVariants(db, "honey")).toMatchObject({
      image: "/gallery.png",
      minPrice: 1200,
    });
    expect((await getSearchSuggestions(db, "Honey")).products[0]).toMatchObject({
      image: "/gallery.png",
      minPrice: 1200,
    });
  });

  it("stores covers in the gallery without discarding existing images", async () => {
    const { db } = await database();
    await db
      .insert(schema.productImage)
      .values({ productId: "p", url: "/detail.png", sortOrder: -4 });
    await setCoverUrl(db, "p", "/new.png");
    await setCoverUrl(db, "p", "/new.png");
    expect((await listProductImages(db, "p")).map((row) => row.url)).toEqual([
      "/new.png",
      "/detail.png",
    ]);
  });

  it("accepts product details without a price and leaves variants and gallery untouched", async () => {
    const { db } = await database();
    const fields = { name: "Updated", description: "Honey", categoryId: "c" };
    expect(productInputSchema.safeParse(fields).success).toBe(true);
    await db.insert(schema.productImage).values({ productId: "p", url: "/gallery.png" });
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    expect(
      await applyProductForm(
        db,
        {
          platform: undefined,
          request: new Request("https://example.com", { method: "POST", body: form }),
        },
        "p",
      ),
    ).toEqual({ ok: true, id: "p" });
    expect((await db.select().from(schema.productVariant))[0]).toMatchObject({
      price: 1200,
      stock: 7,
      image: "/variant.png",
    });
    expect((await listProductImages(db, "p")).map((row) => row.url)).toEqual(["/gallery.png"]);
  });

  it("backfills missing legacy covers and bridges old-app writes without dropping columns", async () => {
    const { db, client } = await database();
    await db
      .insert(schema.productImage)
      .values({ id: "detail", productId: "p", url: "/detail.png", sortOrder: -3 });
    const migration = readFileSync("drizzle/0017_catalog_authority.sql", "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.execute(statement);
    }
    expect((await listProductImages(db, "p")).map((row) => row.url)).toEqual([
      "/legacy.png",
      "/detail.png",
    ]);
    await client.execute(
      "UPDATE store_product SET image = '/old-app.png', price = 42, stock = 8 WHERE id = 'p'",
    );
    expect((await listProductImages(db, "p"))[0]?.url).toBe("/old-app.png");
    expect((await db.select().from(schema.productVariant))[0]).toMatchObject({
      price: 1200,
      stock: 7,
    });
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  });
});
