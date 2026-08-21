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
