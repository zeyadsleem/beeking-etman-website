import { error } from "@sveltejs/kit";
import { isDepartment, type Department } from "$lib/server/store";
import { loadStorePage } from "$lib/server/store-page";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const raw = event.params.department;
  if (!isDepartment(raw)) error(404, t(lang, "products.notFound"));
  const department: Department = raw;
  return loadStorePage(event, department);
};
