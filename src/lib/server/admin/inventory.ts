/**
 * Inventory operations behind the admin warehouse / inventory screens.
 *
 * Owns the three flows that mutate storehouse tables:
 *   - reorder + expiry + low-stock detection (`listStockAlerts`)
 *   - raw → packaged conversion (`recordConversion`)
 *   - inter-warehouse transfers (`createTransfer` / `completeTransfer` /
 *     `cancelTransfer`, `listTransfers`)
 *
 * Money-free counts are stored as integers; honey mass (kg) as `real`.
 */
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { logAdminAction } from "$lib/server/admin/audit";
import { affectedRowCount } from "$lib/server/sqlite";
import { retryOnBusy } from "$lib/server/sqlite";

export const INVENTORY_PAGE_SIZE = 20;

/** Days from now inside which an expiring batch is flagged. */
export const EXPIRY_ALERT_DAYS = 90;
/** A batch is "low" once remaining mass drops to this share of its initial kg. */
export const BATCH_LOW_SHARE = 0.2;

export interface WarehouseRow {
  id: string;
  type: "bulk" | "fulfillment";
  name: string;
  nameEn: string;
  isDefault: boolean;
}

export function parseWarehouseType(value: string): "bulk" | "fulfillment" | null {
  return value === "bulk" || value === "fulfillment" ? value : null;
}

export async function listWarehouses(db: LibSQLDatabase<typeof schema>): Promise<WarehouseRow[]> {
  const rows = await db.select().from(schema.warehouse).orderBy(asc(schema.warehouse.name));
  return rows.map((row) => ({
    id: row.id,
    type: parseWarehouseType(row.type) ?? "fulfillment",
    name: row.name,
    nameEn: row.nameEn,
    isDefault: row.isDefault,
  }));
}

export interface StockAlert {
  id: string;
  kind: "low_variant" | "low_batch" | "expiring_batch" | "low_material";
  label: string;
  stock: number;
  stockLabel: string;
  detail: string;
}

export interface StockAlertsResult {
  alerts: StockAlert[];
  counts: { lowVariant: number; lowBatch: number; expiringBatch: number; lowMaterial: number };
}

function labelFor(lang: "ar" | "en", ar: string, en: string): string {
  return lang === "ar" ? ar : en;
}

/**
 * Low-stock / expiry snapshot. All arms are read-only. Thresholds use the
 * shared LOW_STOCK_THRESHOLD so the dashboard and the everyday product list
 * agree on what "low" means. Returns items plus a per-kind count so the page
 * can render summary badges without re-deriving the list.
 */
export async function listStockAlerts(
  db: LibSQLDatabase<typeof schema>,
  opts: { lang?: "ar" | "en" } = {},
): Promise<StockAlertsResult> {
  const lang = opts.lang ?? "ar";
  const now = Date.now();
  const expiryCutoff = now + EXPIRY_ALERT_DAYS * 24 * 60 * 60 * 1000;
  const alerts: StockAlert[] = [];

  const lowVariants = await db
    .select({
      id: schema.productVariant.id,
      name: schema.productVariant.name,
      nameEn: schema.productVariant.nameEn,
      stock: schema.productVariant.stock,
      productName: schema.product.name,
    })
    .from(schema.productVariant)
    .innerJoin(schema.product, eq(schema.productVariant.productId, schema.product.id))
    .where(lte(schema.productVariant.stock, 10))
    .orderBy(asc(schema.productVariant.stock))
    .limit(200);
  for (const variant of lowVariants) {
    const name = labelFor(lang, variant.name, variant.nameEn || variant.name);
    alerts.push({
      id: variant.id,
      kind: "low_variant",
      label: name,
      stock: variant.stock,
      stockLabel: `${variant.stock}`,
      detail: labelFor(lang, variant.productName, variant.productName),
    });
  }

  const batchRows = await db
    .select()
    .from(schema.batch)
    .where(lte(schema.batch.expiryDate, expiryCutoff))
    .orderBy(asc(schema.batch.expiryDate))
    .limit(200);
  const lowBatchRows = await db
    .select()
    .from(schema.batch)
    .where(gt(schema.batch.quantityKg, 0))
    .orderBy(asc(schema.batch.quantityKg))
    .limit(200);

  const seenLowBatches = new Set<string>();
  const lowBatchIds = new Set<string>();
  for (const row of batchRows) {
    const low = row.quantityKg <= row.initialQuantityKg * BATCH_LOW_SHARE;
    seenLowBatches.add(row.id);
    if (low) {
      lowBatchIds.add(row.id);
      alerts.push({
        id: row.id,
        kind: "low_batch",
        label: row.batchNumber,
        stock: Math.round(row.quantityKg * 1000),
        stockLabel: `${row.quantityKg} kg`,
        detail: labelFor(lang, "كمية متبقية قليلة", "Low remaining mass"),
      });
    }
    alerts.push({
      id: row.id,
      kind: "expiring_batch",
      label: row.batchNumber,
      stock: row.expiryDate,
      stockLabel: new Date(row.expiryDate).toISOString().slice(0, 10),
      detail: labelFor(lang, "ينتهي قريباً", "Expiring soon"),
    });
  }
  for (const row of lowBatchRows) {
    if (seenLowBatches.has(row.id)) continue;
    if (row.quantityKg <= row.initialQuantityKg * BATCH_LOW_SHARE) {
      lowBatchIds.add(row.id);
      alerts.push({
        id: row.id,
        kind: "low_batch",
        label: row.batchNumber,
        stock: Math.round(row.quantityKg * 1000),
        stockLabel: `${row.quantityKg} kg`,
        detail: labelFor(lang, "كمية متبقية قليلة", "Low remaining mass"),
      });
    }
  }

  const lowMaterials = await db
    .select()
    .from(schema.packagingMaterial)
    .where(
      sql`${schema.packagingMaterial.stockQuantity} <= ${schema.packagingMaterial.reorderPoint}`,
    )
    .orderBy(asc(schema.packagingMaterial.stockQuantity))
    .limit(200);
  for (const material of lowMaterials) {
    alerts.push({
      id: material.id,
      kind: "low_material",
      label: labelFor(lang, material.name, material.nameEn || material.name),
      stock: material.stockQuantity,
      stockLabel: `${material.stockQuantity}`,
      detail: labelFor(lang, "مخزون منخفض", "Low material stock"),
    });
  }

  return {
    alerts,
    counts: {
      lowVariant: lowVariants.length,
      // Count low batches specifically — seenLowBatches tracks every expiring
      // batch, so using its size inflated the badge with non-low batches.
      lowBatch: lowBatchIds.size,
      expiringBatch: batchRows.length,
      lowMaterial: lowMaterials.length,
    },
  };
}

export type ConversionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason:
        | "invalid"
        | "batchNotFound"
        | "variantNotFound"
        | "notEnoughRaw"
        | "materialNotFound"
        | "notEnoughMaterial";
    };

export async function recordConversion(
  db: LibSQLDatabase<typeof schema>,
  input: {
    batchId: string;
    variantId: string;
    rawKgsUsed: number;
    unitsProduced: number;
    materialId?: string;
    materialUnits?: number;
    notes?: string;
    userId?: string;
  },
): Promise<ConversionResult> {
  if (!Number.isFinite(input.rawKgsUsed) || input.rawKgsUsed <= 0)
    return { ok: false, reason: "invalid" };
  if (!Number.isInteger(input.unitsProduced) || input.unitsProduced <= 0)
    return { ok: false, reason: "invalid" };
  if (
    input.materialId !== undefined &&
    (!Number.isInteger(input.materialUnits) || (input.materialUnits ?? 0) <= 0)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const [batchRow] = await db
    .select({ id: schema.batch.id, quantityKg: schema.batch.quantityKg })
    .from(schema.batch)
    .where(eq(schema.batch.id, input.batchId))
    .limit(1);
  if (!batchRow) return { ok: false, reason: "batchNotFound" };

  const [variantRow] = await db
    .select({ id: schema.productVariant.id })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.id, input.variantId))
    .limit(1);
  if (!variantRow) return { ok: false, reason: "variantNotFound" };

  const materialId =
    typeof input.materialUnits === "number" &&
    Number.isInteger(input.materialUnits) &&
    input.materialUnits > 0
      ? (input.materialId ?? null)
      : null;
  const spendMaterial = materialId === null ? 0 : (input.materialUnits ?? 0);
  if (materialId !== null) {
    const [materialRow] = await db
      .select({
        id: schema.packagingMaterial.id,
        stockQuantity: schema.packagingMaterial.stockQuantity,
      })
      .from(schema.packagingMaterial)
      .where(eq(schema.packagingMaterial.id, materialId))
      .limit(1);
    if (!materialRow) return { ok: false, reason: "materialNotFound" };
    if (materialRow.stockQuantity < spendMaterial)
      return { ok: false, reason: "notEnoughMaterial" };
  }

  const conversionId = crypto.randomUUID();
  const now = Date.now();
  try {
    await retryOnBusy(() =>
      db.batch([
        db
          .update(schema.batch)
          .set({
            quantityKg: sql`CASE WHEN ${schema.batch.quantityKg} >= ${input.rawKgsUsed}
              THEN ${schema.batch.quantityKg} - ${input.rawKgsUsed} ELSE NULL END`,
          })
          .where(eq(schema.batch.id, input.batchId)),
        db
          .update(schema.productVariant)
          .set({ stock: sql`${schema.productVariant.stock} + ${input.unitsProduced}` })
          .where(eq(schema.productVariant.id, input.variantId)),
        ...(materialId !== null
          ? [
              db
                .update(schema.packagingMaterial)
                .set({
                  stockQuantity: sql`CASE WHEN ${schema.packagingMaterial.stockQuantity} >= ${spendMaterial}
                    THEN ${schema.packagingMaterial.stockQuantity} - ${spendMaterial} ELSE NULL END`,
                })
                .where(eq(schema.packagingMaterial.id, materialId)),
            ]
          : []),
        db.insert(schema.stockConversion).values({
          id: conversionId,
          batchId: input.batchId,
          variantId: input.variantId,
          rawKgsUsed: input.rawKgsUsed,
          unitsProduced: input.unitsProduced,
          createdAt: now,
        }),
        db.insert(schema.stockMovement).values({
          id: crypto.randomUUID(),
          type: "conversion",
          itemType: "batch",
          itemId: input.batchId,
          quantity: -Math.round(input.rawKgsUsed * 1000),
          refId: conversionId,
          notes: input.notes,
          createdAt: now,
        }),
        db.insert(schema.stockMovement).values({
          id: crypto.randomUUID(),
          type: "conversion",
          itemType: "variant",
          itemId: input.variantId,
          quantity: input.unitsProduced,
          refId: conversionId,
          notes: input.notes,
          createdAt: now,
        }),
        ...(materialId !== null
          ? [
              db.insert(schema.stockMovement).values({
                id: crypto.randomUUID(),
                type: "conversion",
                itemType: "material",
                itemId: materialId,
                quantity: sql`(SELECT ${-spendMaterial} FROM ${schema.packagingMaterial} WHERE ${schema.packagingMaterial.id} = ${materialId})`,
                refId: conversionId,
                notes: input.notes,
                createdAt: now,
              }),
            ]
          : []),
      ]),
    );
  } catch (error) {
    let cause: unknown = error;
    while (cause instanceof Error) {
      if (cause.message.includes("NOT NULL constraint failed: store_batch.quantity_kg"))
        return { ok: false, reason: "notEnoughRaw" };
      if (
        cause.message.includes(
          "NOT NULL constraint failed: store_packaging_material.stock_quantity",
        )
      )
        return { ok: false, reason: "notEnoughMaterial" };
      if (cause.message.includes("NOT NULL constraint failed: store_stock_movement.quantity"))
        return { ok: false, reason: "materialNotFound" };
      cause = cause.cause;
    }
    throw error;
  }

  logAdminAction(db, {
    action: "inventory.conversion",
    targetType: "product",
    targetId: input.variantId,
    details: {
      batchId: input.batchId,
      rawKgsUsed: input.rawKgsUsed,
      unitsProduced: input.unitsProduced,
    },
    userId: input.userId,
  });

  return { ok: true, id: conversionId };
}

export type TransferStatus = "pending" | "outbound" | "completed" | "cancelled";

function parseTransferStatus(value: string): TransferStatus | null {
  return value === "pending" ||
    value === "outbound" ||
    value === "completed" ||
    value === "cancelled"
    ? value
    : null;
}

export interface TransferItemInput {
  itemType: "variant" | "batch" | "material";
  itemId: string;
  quantity: number;
}

export interface AdminTransferRow {
  id: string;
  fromWarehouse: string;
  toWarehouse: string;
  status: TransferStatus;
  notes: string | null;
  createdAt: number;
  completedAt: number | null;
  items: TransferItemInput[];
}

export type TransferCreateResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid" | "sameWarehouse" | "warehouseNotFound" | "empty" };

export type TransferUpdateResult =
  | { ok: true; id: string }
  | { ok: false; reason: "notFound" | "invalidTransition" };

export async function createTransfer(
  db: LibSQLDatabase<typeof schema>,
  input: {
    fromWarehouseId: string;
    toWarehouseId: string;
    items: TransferItemInput[];
    notes?: string;
    userId?: string;
  },
): Promise<TransferCreateResult> {
  if (input.fromWarehouseId === input.toWarehouseId) return { ok: false, reason: "sameWarehouse" };
  if (!Array.isArray(input.items) || input.items.length === 0)
    return { ok: false, reason: "empty" };
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0)
      return { ok: false, reason: "invalid" };
    if (item.itemType !== "variant" && item.itemType !== "batch" && item.itemType !== "material") {
      return { ok: false, reason: "invalid" };
    }
  }

  const fromRows = await db
    .select({ id: schema.warehouse.id })
    .from(schema.warehouse)
    .where(inArray(schema.warehouse.id, [input.fromWarehouseId, input.toWarehouseId]));
  if (fromRows.length !== 2) return { ok: false, reason: "warehouseNotFound" };

  const id = crypto.randomUUID();
  const now = Date.now();
  await retryOnBusy(() =>
    db.batch([
      db.insert(schema.transfer).values({
        id,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: "pending",
        notes: input.notes,
        createdAt: now,
      }),
      ...input.items.map((item) =>
        db.insert(schema.transferItem).values({
          id: crypto.randomUUID(),
          transferId: id,
          itemType: item.itemType,
          itemId: item.itemId,
          quantity: item.quantity,
        }),
      ),
    ]),
  );

  logAdminAction(db, {
    action: "inventory.transfer.create",
    targetType: "warehouse",
    targetId: input.fromWarehouseId,
    details: { transferId: id, itemCount: input.items.length },
    userId: input.userId,
  });

  return { ok: true, id };
}

export async function listTransfers(
  db: LibSQLDatabase<typeof schema>,
  opts?: { page?: number },
): Promise<{ items: AdminTransferRow[]; total: number }> {
  const page = Math.max(1, Math.trunc(opts?.page ?? 1));
  const totalRows = await db.select({ total: sql<number>`count(*)` }).from(schema.transfer);
  const total = Number(totalRows[0]?.total ?? 0);

  const rows = await db
    .select({
      id: schema.transfer.id,
      fromWarehouseId: schema.transfer.fromWarehouseId,
      toWarehouseId: schema.transfer.toWarehouseId,
      status: schema.transfer.status,
      notes: schema.transfer.notes,
      createdAt: schema.transfer.createdAt,
      completedAt: schema.transfer.completedAt,
    })
    .from(schema.transfer)
    .orderBy(desc(schema.transfer.createdAt), desc(schema.transfer.id))
    .limit(INVENTORY_PAGE_SIZE)
    .offset((page - 1) * INVENTORY_PAGE_SIZE);

  const warehouses = await db.select().from(schema.warehouse);
  const nameById = new Map(warehouses.map((row) => [row.id, row.nameEn || row.name]));

  const ids = rows.map((row) => row.id);
  const items =
    ids.length === 0
      ? []
      : await db
          .select({
            transferId: schema.transferItem.transferId,
            itemType: schema.transferItem.itemType,
            itemId: schema.transferItem.itemId,
            quantity: schema.transferItem.quantity,
          })
          .from(schema.transferItem)
          .where(inArray(schema.transferItem.transferId, ids));

  const itemsByTransfer = new Map<string, TransferItemInput[]>();
  for (const item of items) {
    const list = itemsByTransfer.get(item.transferId) ?? [];
    list.push({
      itemType:
        item.itemType === "batch" || item.itemType === "material" ? item.itemType : "variant",
      itemId: item.itemId,
      quantity: item.quantity,
    });
    itemsByTransfer.set(item.transferId, list);
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      fromWarehouse: nameById.get(row.fromWarehouseId) ?? row.fromWarehouseId,
      toWarehouse: nameById.get(row.toWarehouseId) ?? row.toWarehouseId,
      status: parseTransferStatus(row.status) ?? "pending",
      notes: row.notes,
      createdAt: Number(row.createdAt),
      completedAt: row.completedAt === null ? null : Number(row.completedAt),
      items: itemsByTransfer.get(row.id) ?? [],
    })),
    total,
  };
}

const TRANSFER_ALLOWED: Record<TransferStatus, readonly TransferStatus[]> = {
  pending: ["outbound", "cancelled"],
  outbound: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Move a transfer forward: `outbound` marks it dispatched, `completed` records
 * the movement rows (paper trail only — single-channel stock is not doubled on
 * the source/target warehouses), and `cancelled` only ever returns an
 * open transfer to the shelf-plan. One update is the authorization guard: the
 * status flip lands only from its current state so exactly one caller wins.
 */
export async function completeTransfer(
  db: LibSQLDatabase<typeof schema>,
  transferId: string,
  next: Exclude<TransferStatus, "pending">,
  opts: { userId?: string } = {},
): Promise<TransferUpdateResult> {
  const [current] = await db
    .select({
      id: schema.transfer.id,
      status: schema.transfer.status,
      fromWarehouseId: schema.transfer.fromWarehouseId,
      toWarehouseId: schema.transfer.toWarehouseId,
    })
    .from(schema.transfer)
    .where(eq(schema.transfer.id, transferId))
    .limit(1);
  if (!current) return { ok: false, reason: "notFound" };

  const from = parseTransferStatus(current.status);
  if (!from || !TRANSFER_ALLOWED[from].includes(next))
    return { ok: false, reason: "invalidTransition" };

  const [flip] = await retryOnBusy(() =>
    db.batch([
      db
        .update(schema.transfer)
        .set({
          status: next,
          completedAt: next === "completed" ? Date.now() : schema.transfer.completedAt,
        })
        .where(and(eq(schema.transfer.id, transferId), eq(schema.transfer.status, current.status))),
    ]),
  );
  if (affectedRowCount(flip) !== 1) return { ok: false, reason: "invalidTransition" };

  if (next === "completed") {
    try {
      const rows = await db
        .select({
          itemType: schema.transferItem.itemType,
          itemId: schema.transferItem.itemId,
          quantity: schema.transferItem.quantity,
        })
        .from(schema.transferItem)
        .where(eq(schema.transferItem.transferId, transferId));
      const [firstRow, ...restRows] = rows;
      if (firstRow) {
        const now = Date.now();
        const toItem = (
          row: { itemType: string; itemId: string; quantity: number },
          warehouseId: string,
          sign: -1 | 1,
        ) =>
          db.insert(schema.stockMovement).values({
            id: crypto.randomUUID(),
            type: "transfer",
            itemType:
              row.itemType === "batch" || row.itemType === "material" ? row.itemType : "variant",
            itemId: row.itemId,
            warehouseId,
            quantity: row.quantity * sign,
            refId: transferId,
            createdAt: now,
          });
        await db.batch([
          toItem(firstRow, current.fromWarehouseId, -1),
          toItem(firstRow, current.toWarehouseId, 1),
          ...restRows.flatMap((row) => [
            toItem(row, current.fromWarehouseId, -1),
            toItem(row, current.toWarehouseId, 1),
          ]),
        ]);
      }
    } catch (error) {
      // Compensate so a completed transfer never lacks its movement trail:
      // reopen the transfer for a retry before surfacing the failure (M2).
      try {
        await db
          .update(schema.transfer)
          .set({ status: from, completedAt: null })
          .where(and(eq(schema.transfer.id, transferId), eq(schema.transfer.status, "completed")));
      } catch (revertError) {
        console.error(
          "[completeTransfer] compensation failed; transfer is completed without movement rows",
          { transferId, error: revertError },
        );
      }
      console.error("[completeTransfer] movement rows failed; transfer reopened", {
        transferId,
        error,
      });
      throw error;
    }
  }

  logAdminAction(db, {
    action: next === "cancelled" ? "inventory.transfer.cancel" : "inventory.transfer.complete",
    targetType: "warehouse",
    targetId: current.fromWarehouseId,
    details: { transferId, status: next },
    userId: opts.userId,
  });

  return { ok: true, id: transferId };
}
