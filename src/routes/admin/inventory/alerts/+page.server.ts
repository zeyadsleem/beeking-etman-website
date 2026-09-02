import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import { isAdminRole } from "$lib/server/admin/roles";
import { listStockAlerts } from "$lib/server/admin/inventory";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!isAdminRole(event.locals.user?.role)) redirect(302, "/login");
  const lang = getLang(event);
  const result = await listStockAlerts(db, { lang });
  return { alerts: result.alerts, counts: result.counts, lang };
};
