import { isLang } from "$lib/i18n/messages";
import { setLangCookie } from "$lib/server/lang";
import { json } from "@sveltejs/kit";

export function POST({ url, cookies }: { url: URL; cookies: import("@sveltejs/kit").Cookies }) {
  const raw = url.searchParams.get("lang") ?? "";
  const lang = isLang(raw) ? raw : "ar";
  setLangCookie(cookies, lang);
  return json({ ok: true, lang });
}
