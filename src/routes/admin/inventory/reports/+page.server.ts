import { sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import { isAdminRole } from "$lib/server/admin/roles";
import { listStockAlerts, listWarehouses } from "$lib/server/admin/inventory";
import * as schema from "$lib/server/db/schema";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!isAdminRole(event.locals.user?.role)) redirect(302, "/login");
  const lang = getLang(event);

  const batchAgg = await db
    .select({
      batchCount: sql<number>`count(*)`,
      totalKg: sql<number>`coalesce(sum(${schema.batch.quantityKg}), 0)`,
    })
    .from(schema.batch);
  const materialAgg = await db
    .select({
      materialCount: sql<number>`count(*)`,
      totalValue: sql<number>`coalesce(sum(${schema.packagingMaterial.stockQuantity} * ${schema.packagingMaterial.costPerUnit}), 0)`,
    })
    .from(schema.packagingMaterial);

  const alerts = await listStockAlerts(db, { lang });
  const warehouses = await listWarehouses(db);

  return {
    lang,
    batchCount: Number(batchAgg[0]?.batchCount ?? 0),
    totalKg: Number(batchAgg[0]?.totalKg ?? 0),
    materialCount: Number(materialAgg[0]?.materialCount ?? 0),
    materialValue: Number(materialAgg[0]?.totalValue ?? 0),
    alerts: alerts.counts,
    warehouseCount: warehouses.length,
  };
};
