import { inArray } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { getLang } from "$lib/server/lang";
import { localized, t } from "$lib/i18n/messages";
import {
  ADDITIVE_LABELS,
  ADDITIVE_PRODUCT_SLUGS,
  BASE_HONEY_OPTIONS,
  isAdditiveKey,
  type AdditiveKey,
  type BaseHoneyOption,
  type JarSize,
} from "$lib/blends";
import { getAllBenefits } from "$lib/server/admin/blend-benefits";
import {
  DEFAULT_HONEY_BENEFITS,
  DEFAULT_ADDITIVE_BENEFITS,
  type BenefitText,
} from "$lib/blend-lab/benefits";

export interface BlendBaseHoney {
  optionId: BaseHoneyOption["id"];
  jarSize: JarSize;
  productId: string;
  variantId: string;
  name: string;
  image: string;
  price: number;
  stock: number;
}

export interface BlendAdditiveCatalog {
  key: AdditiveKey;
  label: string;
  productId: string;
  variantId: string;
  name: string;
  image: string;
  price: number;
  stock: number;
}

export const load: PageServerLoad = async (event) => {
  event.setHeaders({ "cache-control": "s-maxage=120, stale-while-revalidate=600" });
  const lang = getLang(event);

  const slugs = [
    ...BASE_HONEY_OPTIONS.flatMap((o) => [o.halfProductSlug, o.fullProductSlug]),
    ...Object.values(ADDITIVE_PRODUCT_SLUGS),
  ];
  const products = await db
    .select()
    .from(schema.product)
    .where(inArray(schema.product.slug, slugs));
  const variants = await db
    .select()
    .from(schema.productVariant)
    .where(
      inArray(
        schema.productVariant.productId,
        products.map((p) => p.id),
      ),
    );
  const productBySlug = new Map(products.map((p) => [p.slug, p]));
  const variantByProductId = new Map<string, typeof schema.productVariant.$inferSelect>();
  for (const v of variants) {
    if (!variantByProductId.has(v.productId)) variantByProductId.set(v.productId, v);
  }

  if (products.length !== slugs.length || variantByProductId.size !== products.length) {
    error(500, t(lang, "products.unavailable"));
  }

  const baseHoneys = new Map<BaseHoneyOption["id"], Record<JarSize, BlendBaseHoney>>();
  for (const option of BASE_HONEY_OPTIONS) {
    const entry = {} as Record<JarSize, BlendBaseHoney>;
    for (const jarSize of ["half", "full"] as const) {
      const product = productBySlug.get(optionToSlug(option, jarSize));
      const variant = product ? variantByProductId.get(product.id) : undefined;
      if (!product || !variant) error(500, t(lang, "products.unavailable"));
      entry[jarSize] = {
        optionId: option.id,
        jarSize,
        productId: product.id,
        variantId: variant.id,
        name: localized(product.name, product.nameEn, lang),
        image: variant.image,
        price: variant.price,
        stock: variant.stock,
      };
    }
    baseHoneys.set(option.id, entry);
  }

  const additives = new Map<AdditiveKey, BlendAdditiveCatalog>();
  for (const key of Object.keys(ADDITIVE_PRODUCT_SLUGS) as AdditiveKey[]) {
    if (!isAdditiveKey(key)) continue;
    const product = productBySlug.get(ADDITIVE_PRODUCT_SLUGS[key]);
    const variant = product ? variantByProductId.get(product.id) : undefined;
    if (!product || !variant) error(500, t(lang, "products.unavailable"));
    additives.set(key, {
      key,
      label: localized(ADDITIVE_LABELS[key].ar, ADDITIVE_LABELS[key].en, lang),
      productId: product.id,
      variantId: variant.id,
      name: localized(product.name, product.nameEn, lang),
      image: variant.image,
      price: variant.price,
      stock: variant.stock,
    });
  }

  const sidrImage = baseHoneys.get("sidr")?.full.image;
  if (!sidrImage) error(500, t(lang, "products.unavailable"));

  // Fetch benefit texts from DB, falling back to hardcoded defaults.
  const dbBenefits = await getAllBenefits(db);
  const honeyBenefits: Record<string, BenefitText> = { ...DEFAULT_HONEY_BENEFITS };
  const additiveBenefits: Record<string, BenefitText> = { ...DEFAULT_ADDITIVE_BENEFITS };

  for (const [key, row] of dbBenefits) {
    if (key in honeyBenefits) {
      honeyBenefits[key] = { ar: row.valueAr, en: row.valueEn };
    } else if (key in additiveBenefits) {
      additiveBenefits[key] = { ar: row.valueAr, en: row.valueEn };
    }
  }

  return {
    lang,
    blendImage: sidrImage,
    baseHoneys: [...baseHoneys.entries()],
    additives: [...additives.entries()],
    honeyBenefits: honeyBenefits as Record<BaseHoneyOption["id"], BenefitText>,
    additiveBenefits: additiveBenefits as Record<AdditiveKey, BenefitText>,
  };
};

function optionToSlug(option: BaseHoneyOption, jarSize: JarSize): string {
  return jarSize === "half" ? option.halfProductSlug : option.fullProductSlug;
}
