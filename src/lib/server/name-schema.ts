import { z } from "zod";
import { t, type Lang } from "$lib/i18n/messages";

// Shared person-name validation: the account display name and address
// recipient names follow the same trim + 2-80 char rule with the
// "schema.name" message.
export function nameSchema(lang: Lang = "ar"): z.ZodType<string> {
  return z.string().trim().min(2, t(lang, "schema.name")).max(80, t(lang, "schema.name"));
}
