import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const category = sqliteTable("store_category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  slug: text("slug").notNull().unique(),
});

export const product = sqliteTable("store_product", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  descriptionEn: text("description_en").notNull().default(""),
  price: integer("price").notNull(),
  stock: integer("stock").notNull().default(0),
  image: text("image").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => category.id),
  featured: integer("featured").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const productVariant = sqliteTable("store_product_variant", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => product.id),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  price: integer("price").notNull(),
  stock: integer("stock").notNull().default(0),
  image: text("image").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productImage = sqliteTable("store_product_image", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => product.id),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const order = sqliteTable("store_order", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  nonce: text("nonce").unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("paid"),
  userId: text("user_id"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const orderItem = sqliteTable("store_order_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id")
    .notNull()
    .references(() => order.id),
  productId: text("product_id")
    .notNull()
    .references(() => product.id),
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull().default(""),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
});

export const rateLimit = sqliteTable(
  "store_rate_limit",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);

export * from "./auth.schema";
