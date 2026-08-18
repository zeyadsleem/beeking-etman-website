import { inArray } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { getLang } from "$lib/server/lang";
import { localized } from "$lib/server/store";
import { t } from "$lib/i18n/messages";
import {
  ADDITIVE_LABELS,
  ADDITIVE_PRODUCT_SLUGS,
  BASE_HONEY_OPTIONS,
  isAdditiveKey,
  type AdditiveKey,
  type BaseHoneyOption,
  type JarSize,
} from "$lib/blends";

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

  return {
    lang,
    blendImage: sidrImage,
    baseHoneys: [...baseHoneys.entries()],
    additives: [...additives.entries()],
  };
};

function optionToSlug(option: BaseHoneyOption, jarSize: JarSize): string {
  return jarSize === "half" ? option.halfProductSlug : option.fullProductSlug;
}
