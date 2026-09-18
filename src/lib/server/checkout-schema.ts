import { t, type Lang } from "$lib/i18n/messages";
import { GOVERNORATES, type GovernorateCode } from "$lib/shipping";
import { V1_PAYMENT_METHODS } from "$lib/settlement/types";
import { nameSchema } from "$lib/server/name-schema";
import { z } from "zod";

export function createCheckoutSchema(lang: Lang = "ar") {
  return z.object({
    nonce: z.string().uuid(t(lang, "schema.nonce")),
    // Bounded like the saved-address schema: an unbounded field would flow
    // into D1 rows and transactional email bodies unchecked (T11).
    email: z.string().trim().email(t(lang, "schema.email")).max(254, t(lang, "schema.email")),
    name: nameSchema(lang),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?20|0)?1[0-9]{9}$/, t(lang, "schema.phone"))
      .max(20, t(lang, "schema.phone")),
    city: z.string().trim().min(2, t(lang, "schema.city")).max(60, t(lang, "schema.city")),
    address: z
      .string()
      .trim()
      .min(5, t(lang, "schema.address"))
      .max(200, t(lang, "schema.address")),
    governorate: z.enum(
      GOVERNORATES.map((z) => z.code) as [GovernorateCode, ...GovernorateCode[]],
      {
        message: t(lang, "schema.governorate"),
      },
    ),
    paymentMethod: z.enum(V1_PAYMENT_METHODS, {
      message: t(lang, "schema.paymentMethod"),
    }),
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
