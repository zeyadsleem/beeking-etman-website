import { listAuditLogs } from "$lib/server/admin/audit";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const url = new URL(event.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { items, total } = await listAuditLogs(db, { limit, offset });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    items,
    total,
    page,
    totalPages,
    lang: getLang(event),
  };
};
