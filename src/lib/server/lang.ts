import { isLang, LANG_COOKIE_NAME, type Lang } from "$lib/i18n/messages";
import type { RequestEvent } from "@sveltejs/kit";

export function getLang(event: Pick<RequestEvent, "cookies">): Lang {
  const cookie = event.cookies.get(LANG_COOKIE_NAME);
  return isLang(cookie) ? cookie : "ar";
}

export function setLangCookie(cookies: RequestEvent["cookies"], lang: Lang): void {
  cookies.set(LANG_COOKIE_NAME, lang, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
