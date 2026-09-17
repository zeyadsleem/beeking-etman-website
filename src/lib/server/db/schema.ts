import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const category = sqliteTable("store_category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  slug: text("slug").notNull().unique(),
  department: text("department").notNull().default("honey"),
  parentId: text("parent_id").references((): AnySQLiteColumn => category.id),
});

export const product = sqliteTable(
  "store_product",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    nameEn: text("name_en").notNull().default(""),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    descriptionEn: text("description_en").notNull().default(""),
    price: integer("price")
      .notNull()
      .$defaultFn(() => 0),
    stock: integer("stock").notNull().default(0),
    image: text("image")
      .notNull()
      .$defaultFn(() => ""),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id),
    featured: integer("featured").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    department: text("department").notNull().default("honey"),
    sku: text("sku"),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    costPrice: integer("cost_price"),
    weightGrams: integer("weight_grams"),
  },
  (table) => [index("store_product_categoryId_idx").on(table.categoryId)],
);

export const productVariant = sqliteTable(
  "store_product_variant",
  {
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
  },
  (table) => [
    index("store_product_variant_productId_idx").on(table.productId),
    uniqueIndex("store_product_variant_productId_name_unique").on(table.productId, table.name),
  ],
);

export const productImage = sqliteTable(
  "store_product_image",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("store_product_image_productId_idx").on(table.productId)],
);

export const order = sqliteTable(
  "store_order",
  {
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
    governorate: text("governorate").notNull().default("cairo"),
    shippingCost: integer("shipping_cost").notNull().default(0),
    total: integer("total").notNull(),
    status: text("status").notNull().default("paid"),
    paymentStatus: text("payment_status").notNull().default("simulated"),
    stockVersion: text("stock_version").notNull().default("legacy"),
    userId: text("user_id"),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("store_order_userId_createdAt_idx").on(table.userId, table.createdAt)],
);

export const orderItem = sqliteTable(
  "store_order_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    variantId: text("variant_id").references(() => productVariant.id),
    productName: text("product_name").notNull(),
    variantName: text("variant_name").notNull().default(""),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (table) => [index("store_order_item_orderId_idx").on(table.orderId)],
);

export const rateLimit = sqliteTable(
  "store_rate_limit",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);

export const address = sqliteTable(
  "store_address",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    label: text("label").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    isDefault: integer("is_default").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("store_address_userId_idx").on(table.userId)],
);

export const adminAudit = sqliteTable(
  "store_admin_audit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    adminUserId: text("admin_user_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    details: text("details"),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index("store_admin_audit_createdAt_idx").on(table.createdAt),
    index("store_admin_audit_targetType_targetId_idx").on(table.targetType, table.targetId),
  ],
);

export const blendBenefit = sqliteTable("store_blend_benefit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  valueAr: text("value_ar").notNull(),
  valueEn: text("value_en").notNull().default(""),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// --- Inventory: batches / raw stock / packaging (self-bottle from bulk) ---

export const warehouse = sqliteTable("store_warehouse", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // "bulk" (raw honey barrels) | "fulfillment" (market-ready units)
  type: text("type").notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
});

export const batch = sqliteTable(
  "store_batch",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchNumber: text("batch_number").notNull().unique(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    seasonName: text("season_name").notNull(),
    seasonNameEn: text("season_name_en").notNull().default(""),
    apiarySource: text("apiary_source").notNull().default(""),
    harvestDate: integer("harvest_date").notNull(),
    expiryDate: integer("expiry_date").notNull(),
    labCertUrl: text("lab_cert_url"),
    qrCode: text("qr_code"),
    initialQuantityKg: real("initial_quantity_kg").notNull(),
    quantityKg: real("quantity_kg").notNull(),
    notes: text("notes"),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index("store_batch_productId_idx").on(table.productId),
    index("store_batch_expiry_idx").on(table.expiryDate),
  ],
);

export const packagingMaterial = sqliteTable("store_packaging_material", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull().default(""),
  sku: text("sku"),
  unitLabel: text("unit_label").notNull().default(""),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  costPerUnit: integer("cost_per_unit").notNull().default(0),
});

export const stockConversion = sqliteTable(
  "store_stock_conversion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => batch.id),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariant.id),
    rawKgsUsed: real("raw_kgs_used").notNull(),
    unitsProduced: integer("units_produced").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("store_stock_conversion_batchId_idx").on(table.batchId)],
);

export const stockMovement = sqliteTable(
  "store_stock_movement",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // "purchase" | "conversion" | "sale" | "transfer" | "waste" | "damage" | "adjustment"
    type: text("type").notNull(),
    itemType: text("item_type").notNull().default("variant"), // variant | batch | material
    itemId: text("item_id").notNull(),
    warehouseId: text("warehouse_id").references(() => warehouse.id),
    quantity: integer("quantity").notNull(),
    refId: text("ref_id"),
    notes: text("notes"),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    index("store_stock_movement_itemType_itemId_idx").on(table.itemType, table.itemId),
    index("store_stock_movement_createdAt_idx").on(table.createdAt),
  ],
);

export const transfer = sqliteTable(
  "store_transfer",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fromWarehouseId: text("from_warehouse_id")
      .notNull()
      .references(() => warehouse.id),
    toWarehouseId: text("to_warehouse_id")
      .notNull()
      .references(() => warehouse.id),
    status: text("status").notNull().default("pending"), // pending | outbound | completed | cancelled
    notes: text("notes"),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    completedAt: integer("completed_at"),
  },
  (table) => [
    index("store_transfer_status_idx").on(table.status),
    index("store_transfer_fromWarehouseId_idx").on(table.fromWarehouseId),
  ],
);

export const transferItem = sqliteTable(
  "store_transfer_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    transferId: text("transfer_id")
      .notNull()
      .references(() => transfer.id),
    itemType: text("item_type").notNull().default("variant"),
    itemId: text("item_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [index("store_transfer_item_transferId_idx").on(table.transferId)],
);

// --- Notifications (email / Slack / Telegram) ---

export const notification = sqliteTable(
  "store_notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // "low_stock" | "expiry" | "raw_presesason" | "order" | ... (canonical OutboxType union)
    type: text("type").notNull(),
    channel: text("channel").notNull().default("email"), // email | slack | telegram
    recipient: text("recipient").notNull(),
    fromAddress: text("from_address").notNull().default(""),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"), // pending | sending | sent | failed | dead
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at"), // epoch ms; NULL = parked
    lastError: text("last_error"),
    providerMessageId: text("provider_message_id"),
    lockedAt: integer("locked_at"), // lease owner timestamp, epoch ms
    idempotencyKey: text("idempotency_key"), // stable per logical email
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    sentAt: integer("sent_at"),
  },
  (table) => [
    check(
      "store_notification_status_check",
      sql`${table.status} IN ('pending','sending','sent','failed','dead')`,
    ),
    index("store_notification_type_idx").on(table.type),
    index("store_notification_due_idx").on(table.status, table.nextAttemptAt),
    index("store_notification_created_idx").on(table.createdAt),
    uniqueIndex("store_notification_idem_idx")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  ],
);

export * from "./auth.schema";
