import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { isAdminRole } from "$lib/server/admin/roles";
import { getLang } from "$lib/server/lang";

export const load: LayoutServerLoad = (event) => {
  if (!isAdminRole(event.locals.user?.role)) redirect(302, "/login");
  return { user: event.locals.user ?? null, lang: getLang(event) };
};
