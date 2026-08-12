import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const task = sqliteTable("task", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  priority: integer("priority").notNull().default(1),
});

export const category = sqliteTable("store_category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const product = sqliteTable("store_product", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
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

export const order = sqliteTable("store_order", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
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
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
});

export * from "./auth.schema";
