import { getDashboardStats } from "$lib/server/admin/stats";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  return { stats: await getDashboardStats(db), lang: getLang(event) };
};
