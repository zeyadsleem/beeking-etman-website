import { fail } from "@sveltejs/kit";
import { z } from "zod";
import {
  isRoleManager,
  listUsers,
  updateUserRole,
  USER_ROLES,
  USERS_PAGE_SIZE,
} from "$lib/server/admin/roles";
import { t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

const MAX_SAFE_INTEGER = 2 ** 53 - 1;
const pageParam = z.coerce
  .number()
  .finite()
  .catch(1)
  .transform((value) => Math.min(Math.max(1, Math.trunc(value)), MAX_SAFE_INTEGER));

const roleParam = z.enum(USER_ROLES);

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const query = event.url.searchParams.get("q")?.trim() ?? "";
  const requestedPage = pageParam.parse(event.url.searchParams.get("page"));
  const listAt = (p: number) => listUsers(db, { query: query === "" ? undefined : query, page: p });

  let { items, total } = await listAt(requestedPage);
  let page = requestedPage;
  if (items.length === 0 && page > 1 && total > 0) {
    page = Math.ceil(total / USERS_PAGE_SIZE);
    ({ items } = await listAt(page));
  }

  return {
    items,
    total,
    page,
    pageSize: USERS_PAGE_SIZE,
    query,
    lang,
    canManage: isRoleManager(event.locals.user?.role),
  };
};

export const actions: Actions = {
  setRole: async (event) => {
    const lang = getLang(event);
    // The users page is reachable by any admin, but only the super-admin may
    // change roles — enforced again here for direct POSTs.
    if (!isRoleManager(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    const rawId = form.get("userId");
    const id = typeof rawId === "string" ? rawId.trim() : "";
    const role = roleParam.safeParse(form.get("role"));

    if (id === "") return fail(400, { message: t(lang, "errors.unexpected") });
    if (!role.success) return fail(400, { message: t(lang, "admin.users.invalidRole") });

    const result = await updateUserRole(db, id, role.data, {
      id: event.locals.user?.id,
      role: event.locals.user?.role ?? null,
    });
    if (!result.ok) {
      return fail(400, { message: t(lang, "admin.users." + result.reason) });
    }
    return { ok: true };
  },
};
