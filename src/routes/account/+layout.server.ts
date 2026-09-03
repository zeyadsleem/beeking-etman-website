import { redirect } from "@sveltejs/kit";
import { getLang } from "$lib/server/lang";
import { loginRedirectPath } from "$lib/server/login-redirect";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = (event) => {
  if (!event.locals.user) redirect(302, loginRedirectPath(event.url));
  return { lang: getLang(event) };
};
