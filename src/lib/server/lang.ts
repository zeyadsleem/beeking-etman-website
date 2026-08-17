import { isLang, LANG_COOKIE_NAME, type Lang } from "$lib/i18n/messages";
import type { RequestEvent } from "@sveltejs/kit";

// The store targets an Arabic-speaking audience, so Arabic wins whenever the
// browser supports it at all — even if English is the device's primary
// language (common for Egyptian users with English-language devices).
export function parseAcceptLanguage(header: string | null): Lang {
  if (!header) return "ar";
  let hasEnglish = false;
  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    const base = tag.trim().toLowerCase().split("-")[0];
    if (base !== "ar" && base !== "en") continue;
    let q = 1;
    for (const param of params) {
      const [key, raw] = param.trim().split("=");
      if (key !== "q") continue;
      const value = Number(raw);
      if (Number.isFinite(value)) q = value;
    }
    if (q <= 0) continue;
    if (base === "ar") return "ar";
    hasEnglish = true;
  }
  return hasEnglish ? "en" : "ar";
}

export function getLang(event: Pick<RequestEvent, "cookies" | "request">): Lang {
  const cookie = event.cookies.get(LANG_COOKIE_NAME);
  if (isLang(cookie)) return cookie;
  return parseAcceptLanguage(event.request.headers.get("accept-language"));
}

export function setLangCookie(cookies: RequestEvent["cookies"], lang: Lang): void {
  cookies.set(LANG_COOKIE_NAME, lang, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
