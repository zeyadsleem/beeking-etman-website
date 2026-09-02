/**
 * Shared form pipeline behind /admin/products/new and /admin/products/[id]:
 * untrusted multipart → validated ProductInput (+ EGP→qirsh price) → optional
 * KV upload → create/update → cover-image persistence. Both routes must stay
 * behaviorally identical, so the sequencing lives here once.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { RequestEvent } from "@sveltejs/kit";
import type { MessageKey } from "$lib/i18n/messages";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import {
  createProduct,
  generateSlug,
  productInputSchema,
  updateProduct,
  variantInputSchema,
  type ProductInput,
  type VariantInput,
} from "./products";
import { saveProductImage } from "./upload";
import { setCoverUrl } from "./product-images";

/** Sanity cap only: 10M EGP is far above any honey jar. */
const MAX_PRICE_QIRSH = 1_000_000_000;

export type ProductFormFailureReason =
  | "invalid"
  | "too_large"
  | "unsupported"
  | "storage_unavailable"
  | "slug_taken"
  | "category_missing";

export interface ProductFormFailure {
  status: number;
  messageKey: MessageKey;
}

/** One mapping for both routes so status codes never drift apart. */
export function productFormFailure(reason: ProductFormFailureReason): ProductFormFailure {
  switch (reason) {
    case "invalid":
      return { status: 400, messageKey: "errors.unexpected" };
    case "too_large":
      return { status: 400, messageKey: "errors.uploadTooLarge" };
    case "unsupported":
      return { status: 400, messageKey: "errors.uploadUnsupported" };
    case "storage_unavailable":
      return { status: 503, messageKey: "errors.storageUnavailable" };
    case "slug_taken":
      return { status: 409, messageKey: "admin.products.slugTaken" };
    case "category_missing":
      return { status: 409, messageKey: "admin.products.categoryMissing" };
  }
}

/** Narrow instead of String()-coercing: a File entry becomes "", never garbage text. */
function stringField(form: FormData, name: string): string {
  const raw = form.get(name);
  return typeof raw === "string" ? raw : "";
}

function isBlankFile(entry: FormDataEntryValue | null): entry is File {
  // Browsers submit an empty File when nothing was chosen.
  return entry instanceof File && entry.size > 0;
}

/**
 * Admins type prices in EGP ("250.50"); the column stores integer qirsh
 * (25050). Sub-qirsh remainders ("12.999") are rejected rather than silently
 * rounded so what the admin typed is exactly what validates.
 */
export function priceToQirsh(raw: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) return null;
  const qirsh = Math.round(value * 100);
  if (Math.abs(value * 100 - qirsh) > 1e-6) return null;
  if (!Number.isInteger(qirsh) || qirsh <= 0 || qirsh > MAX_PRICE_QIRSH) return null;
  return qirsh;
}

/** Pasted URLs follow the same shape the storefront gallery already stores. */
function pastedUrlOrEmpty(form: FormData): string | null {
  const pasted = stringField(form, "imageUrl").trim();
  if (pasted === "") return "";
  return z.string().url().safeParse(pasted).success ? pasted : null;
}

export type ProductFormResult =
  | { ok: true; id: string }
  | { ok: false; reason: ProductFormFailureReason };

/**
 * Runs the full details pipeline. When a file rides along it uploads BEFORE
 * the database write: a storage failure then aborts with nothing persisted,
 * so resubmitting the same form can never fork a duplicate product (create)
 * or leave half-applied fields (edit). A successful upload followed by a DB
 * failure costs at most an unreferenced KV blob — no row points at it.
 */
export async function applyProductForm(
  db: LibSQLDatabase<typeof schema>,
  event: Pick<RequestEvent, "request" | "platform">,
  productId?: string,
): Promise<ProductFormResult> {
  const form = await event.request.formData();

  const featured = form.get("featured") !== null;
  const priceQirsh = priceToQirsh(stringField(form, "price"));
  const pastedUrl = pastedUrlOrEmpty(form);
  const departmentRaw = stringField(form, "department").trim();
  const parsed = productInputSchema.safeParse({
    name: stringField(form, "name"),
    nameEn: stringField(form, "nameEn"),
    description: stringField(form, "description"),
    descriptionEn: stringField(form, "descriptionEn"),
    price: priceQirsh ?? -1,
    categoryId: stringField(form, "categoryId"),
    featured,
    department: /^(honey|equipment)$/.test(departmentRaw) ? departmentRaw : "honey",
  });
  if (!parsed.success || pastedUrl === null) return { ok: false, reason: "invalid" };
  const input: ProductInput = parsed.data;

  // Slug precedence per plan: explicit field wins, else English name, else Arabic.
  const slugBase = generateSlug(stringField(form, "slug").trim() || input.nameEn || input.name);

  let uploadedUrl: string | null = null;
  const file = form.get("image");
  if (isBlankFile(file)) {
    const platform = event.platform;
    if (!platform) return { ok: false, reason: "storage_unavailable" };
    const upload = await saveProductImage(platform.env.MEDIA, file);
    if (!upload.ok) return { ok: false, reason: upload.reason };
    uploadedUrl = upload.url;
  }

  // Cover resolution: an uploaded file wins, then a pasted URL. A field-only
  // edit provides neither — and updateProduct rewrites the legacy image column
  // on every write (productWriteValues hardcodes it) — so the stored URL is
  // read before the write and re-persisted after; otherwise tweaking just a
  // name or price would silently blank the cover.
  let coverUrl: string;
  if (uploadedUrl !== null) {
    coverUrl = uploadedUrl;
  } else if (pastedUrl !== "") {
    coverUrl = pastedUrl;
  } else if (productId === undefined) {
    coverUrl = ""; // a new product without imagery starts blank
  } else {
    const [row] = await db
      .select({ image: schema.product.image })
      .from(schema.product)
      .where(eq(schema.product.id, productId));
    coverUrl = row?.image ?? "";
  }

  const written =
    productId === undefined
      ? await createProduct(db, input, slugBase)
      : await updateProduct(db, productId, input, slugBase);
  if (!written.ok) return { ok: false, reason: written.reason };

  if (coverUrl !== "") {
    // Cover resolution → setCoverUrl: it also mirrors a single-variant image
    // so the storefront card/gallery reflect the cover immediately (D1).
    await setCoverUrl(db, written.id, coverUrl);
  }

  return { ok: true, id: written.id };
}

export type ParsedVariantForm = { ok: true; id?: string; input: VariantInput } | { ok: false };

function intField(form: FormData, name: string): number | null {
  const value = Number(stringField(form, name).trim());
  if (!Number.isFinite(value)) return null;
  return Math.trunc(value);
}

/**
 * Hidden `variantId` blank ⇒ insert; otherwise update (the service rejects a
 * cross-product id). `nameEn` rides a hidden field so round-tripping a row
 * never blanks data the compact editor does not display.
 */
export function parseVariantForm(form: FormData): ParsedVariantForm {
  const idRaw = stringField(form, "variantId").trim();
  const priceQirsh = priceToQirsh(stringField(form, "price"));
  const stock = intField(form, "stock");
  const sortOrder = intField(form, "sortOrder");
  const pastedUrl = pastedUrlOrEmpty(form);
  if (priceQirsh === null || stock === null || sortOrder === null || pastedUrl === null) {
    return { ok: false };
  }

  const parsed = variantInputSchema.safeParse({
    name: stringField(form, "name"),
    nameEn: stringField(form, "nameEn"),
    price: priceQirsh,
    stock,
    image: pastedUrl,
    sortOrder,
  });
  if (!parsed.success) return { ok: false };

  return { ok: true, id: idRaw === "" ? undefined : idRaw, input: parsed.data };
}
