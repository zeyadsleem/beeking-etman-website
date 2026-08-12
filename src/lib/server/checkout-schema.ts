import { z } from "zod";

export const checkoutSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح"),
  name: z.string().trim().min(2, "الاسم قصير جدًا"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?20|0)?1[0-9]{9}$/, "رقم هاتف مصري غير صالح"),
  city: z.string().trim().min(2, "أدخل اسم المدينة"),
  address: z.string().trim().min(5, "أدخل عنوانًا تفصيليًا"),
  cardNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{13,16}$/, "رقم البطاقة غير صالح"),
  cardExpiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "التاريخ بصيغة MM/YY"),
  cardCvc: z
    .string()
    .trim()
    .regex(/^[0-9]{3,4}$/, "رمز الأمان غير صالح"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
