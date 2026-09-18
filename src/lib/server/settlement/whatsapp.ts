import { formatEGP } from "$lib/currency";
import { t, type Lang } from "$lib/i18n/messages";
import {
  isV1PaymentMethod,
  PAYMENT_METHOD_LABEL_KEY,
  type PaymentMethod,
} from "$lib/settlement/types";

const NON_DIGITS = /\D/g;
const MIN_DIGITS = 10;
const MAX_DIGITS = 15;
// Stored customer numbers use the Egyptian local mobile format; wa.me needs
// the international form, so the leading zero becomes the 20 country code.
const EGYPTIAN_LOCAL_MOBILE = /^01[0125]\d{8}$/;

/**
 * Digits-only international number, or null when the value cannot be one.
 * Accepts `+20…`, `0020…`, and Egyptian local `01…` input.
 */
export function normalizeWhatsappNumber(value: string | undefined | null): string | null {
  if (!value) return null;
  let digits = value.replace(NON_DIGITS, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (EGYPTIAN_LOCAL_MOBILE.test(digits)) digits = `20${digits.slice(1)}`;
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? digits : null;
}

export function whatsappLink(number: string, text: string): string {
  // International numbers never start with 0; rejecting that also catches a
  // local Egyptian number that skipped normalization.
  if (!/^[1-9]\d{9,14}$/.test(number)) {
    throw new Error("whatsappLink requires a normalized international number");
  }
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export interface OrderWhatsappSummary {
  number: string;
  total: number;
  method: PaymentMethod | null;
}

/** Customer-facing prefilled message: order number, total, and method. */
export function customerOrderWhatsappText(order: OrderWhatsappSummary, lang: Lang): string {
  const lines = [
    lang === "ar" ? `طلب رقم ${order.number}` : `Order ${order.number}`,
    `${t(lang, "orderDetail.total")}: ${formatEGP(order.total, lang)}`,
  ];
  if (order.method && isV1PaymentMethod(order.method)) {
    lines.push(
      `${t(lang, "checkout.paymentTitle")}: ${t(lang, PAYMENT_METHOD_LABEL_KEY[order.method])}`,
    );
  }
  return lines.join("\n");
}

/** Shop-facing prefilled message for contacting the customer about an order. */
export function adminOrderWhatsappText(
  order: { number: string; name: string },
  lang: Lang,
): string {
  return lang === "ar"
    ? `مرحبًا ${order.name}، بخصوص طلبك ${order.number} من مملكة النحل.`
    : `Hello ${order.name}, about your order ${order.number} from Kingdom of Honey.`;
}
