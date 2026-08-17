import { getLocale, type Lang } from "./i18n/messages";

const formatters: Record<Lang, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat(getLocale("ar"), { style: "currency", currency: "EGP" }),
  en: new Intl.NumberFormat(getLocale("en"), { style: "currency", currency: "EGP" }),
};

export function formatEGP(amountQirsh: number, lang: Lang = "ar"): string {
  if (!Number.isInteger(amountQirsh) || amountQirsh < 0) return "—";
  return formatters[lang].format(amountQirsh / 100);
}
