import { fail } from "@sveltejs/kit";
import { z } from "zod";
import { getAllBenefits, upsertBenefit } from "$lib/server/admin/blend-benefits";
import { logAdminAction } from "$lib/server/admin/audit";
import { t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

const KEY_MAX = 80;
const VALUE_MAX = 2000;

const benefitSchema = z.object({
  key: z.string().trim().min(1).max(KEY_MAX),
  valueAr: z.string().trim().max(VALUE_MAX).default(""),
  valueEn: z.string().trim().max(VALUE_MAX).default(""),
});

export const load: PageServerLoad = async (event) => {
  if (event.locals.user?.role !== "admin") return { lang: getLang(event), benefits: [] };

  const allBenefits = await getAllBenefits(db);
  const benefits = [...allBenefits.entries()].map(([key, row]) => ({
    key,
    valueAr: row.valueAr,
    valueEn: row.valueEn,
  }));

  return { lang: getLang(event), benefits };
};

export const actions: Actions = {
  save: async (event) => {
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(getLang(event), "errors.unexpected") });

    const lang = getLang(event);
    const form = await event.request.formData();

    const parsed = benefitSchema.safeParse({
      key: String(form.get("key") ?? ""),
      valueAr: String(form.get("valueAr") ?? ""),
      valueEn: String(form.get("valueEn") ?? ""),
    });

    if (!parsed.success) {
      return fail(400, { message: t(lang, "errors.unexpected") });
    }

    const id = await upsertBenefit(db, parsed.data.key, parsed.data.valueAr, parsed.data.valueEn);

    logAdminAction(db, {
      action: "benefit.update",
      targetType: "category",
      targetId: id,
      details: { key: parsed.data.key },
      userId: event.locals.user?.id,
    });

    return { saved: true, savedKey: parsed.data.key };
  },
};
