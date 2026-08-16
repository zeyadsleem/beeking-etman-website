import { t, type Lang } from "$lib/i18n/messages";
import { z } from "zod";

export function createCheckoutSchema(lang: Lang = "ar") {
  return z.object({
    nonce: z.string().uuid(t(lang, "schema.nonce")),
    email: z.string().trim().email(t(lang, "schema.email")),
    name: z.string().trim().min(2, t(lang, "schema.name")),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?20|0)?1[0-9]{9}$/, t(lang, "schema.phone")),
    city: z.string().trim().min(2, t(lang, "schema.city")),
    address: z.string().trim().min(5, t(lang, "schema.address")),
    cardNumber: z
      .string()
      .trim()
      .regex(/^[0-9]{13,16}$/, t(lang, "schema.cardNumber")),
    cardExpiry: z
      .string()
      .trim()
      .regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, t(lang, "schema.cardExpiryFormat"))
      .refine(
        (value) => {
          const match = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/.exec(value);
          if (!match) return true;
          const month = Number(match[1]);
          const year = 2000 + Number(match[2]);
          const validThrough = new Date(year, month, 0, 23, 59, 59, 999);
          return validThrough.getTime() >= Date.now();
        },
        t(lang, "schema.cardExpiryPast"),
      ),
    cardCvc: z
      .string()
      .trim()
      .regex(/^[0-9]{3,4}$/, t(lang, "schema.cardCvc")),
  });
}

export const checkoutSchema = createCheckoutSchema("ar");

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
