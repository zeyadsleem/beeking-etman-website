# Master Plan — 2026-09-02 Admin Operations Upgrade

Owner brief (Arabic, summarized): "عايزك تعمل خطة تطوير عمليات الأدمن" because
**changing a product image did not update the storefront**. Requirements named
by the owner:

1. Fix image edits so the change actually shows on the storefront.
2. **Preview + drag-and-drop** when uploading a new image.
3. **Search in all features/elements** of the admin so the admin can find
   anything by text.
4. **Full edit/update** of every element (complete CRUD across the whole admin).
5. **Complete permissions** (صلاحيات كاملة).
6. A **documented plan with confirmation + tests** proving everything works.

This plan complements but is **separate from** `docs/plan-2026-09-02-priority-overhaul.md`
(that one owns payments/email/sales-ops). Where both touch the same code
(multi-admin permissions = Phase 4.3 there), this plan is the concrete
execution spec and the master plan's Phase 4.3 folds into it.

**Plan-only session scope:** this document is the deliverable; phases build
top-to-bottom, each with its own spec → implementation → quality gate.

---

## Part 1 — Current-state diagnosis (grounded in code)

### 1.1 THE reported bug: changed product image did not update

**Root cause:** the admin image upload writes only the **deprecated legacy
`product.image` column**, but the storefront renders images from the
**variant image** and the **`store_product_image` gallery table** — two data
stores the admin UI never touches.

Evidence chain:

| #   | Step                                                                                                                         | File:line                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `?/uploadImage` action uploads to KV then writes **only** `product.image`                                                    | `src/routes/admin/products/[id]/+page.server.ts:95-99`         |
| 2   | `?/details` save path does the same (file wins → `imageUrl` → re-read existing `product.image`; never gallery/variant)       | `src/lib/server/admin/product-form.ts:143-169`                 |
| 3   | Product list card prefers **variant image**: `product.variants[0]?.image ?? product.image`                                   | `src/lib/components/ProductCard.svelte:44`                     |
| 4   | Product-detail gallery = `[selectedVariant.image, ...product.images]` where `images` comes from the **`productImage` table** | `src/routes/[department]/[category]/[slug]/+page.svelte:51-55` |
| 5   | `store_product.image` is documented `@deprecated` in the schema — price/stock/image are legacy, real data lives on variants  | `src/lib/server/db/schema.ts:33-36`                            |
| 6   | Admin has **no UI** for the `store_product_image` table and variant images only accept a pasted URL                          | `VariantEditor.svelte:101-111`                                 |
| 7   | KV serves `Cache-Control: public, max-age=31536000, immutable`, URL-keyed                                                    | `src/routes/media/[...key]/+server.ts:69,79-89`                |

**Conclusion:** KV caching is NOT the cause (every upload is a fresh UUID key).
The cause is the data-model mismatch: admin writes the fallback column while the
storefront reads the primary one. Confirmed by the existing test which _asserts_
the narrow behaviour (`page.spec.ts:471-485` — "updates only the cover image").

**Fix direction (locked for spec):** a single product image change must update
**variant.image** (single-variant products — the store's model per the
2026-08-14 ADR) and/or insert into `productImage`, while keeping `product.image`
as legacy fallback. A shared cover-resolution helper is the seam.

### 1.2 State of the other owner asks today

| Owner ask           | Current state                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search all features | Products only (`?q=` over name/nameEn, `products/+page.server.ts:33`). Orders/users/categories/audit have **none**.                                                               |
| Full CRUD           | Products ✅ (except image), variants ✅, categories ✅, orders ⚠️ (status only), **users ❌ (no admin page at all)**, audit read-only, media read-only, funnels ❌ (placeholder). |
| Permissions         | Single gate `role === "admin"` everywhere (`admin/+layout.server.ts:5` + per-action re-checks). No user management, no granular roles.                                            |
| Upload UX           | Plain `<input type=file>` + separate button; **no preview, no drag-drop**, no validation feedback loop shared with the server (magic-byte + 5MB at `upload.ts:7,41`).             |

### 1.3 Missing schema fields not surfaced in admin

`store_product.published` (boolean), `costPrice`, `weightGrams`, `sku` all exist
in the schema but the admin forms do not expose them
(`src/lib/server/db/schema.ts:34-39`).

---

## Part 2 — Phases

Phases run top to bottom. Each lands with its own quality gate.

---

### Phase A — Image pipeline repair + admin gallery (The reported bug, critical)

**Goal:** changing an image in admin immediately changes the storefront.

**A.1 Shared cover-resolution helper (the seam).**
Refactor `applyProductForm` + `uploadImage` onto one function, e.g.
`resolveProductImages(db, productId, { file, imageUrl, variantImage })` in
`src/lib/server/admin/product-images.ts`:

- File upload → `saveProductImage(MEDIA, file)` (unchanged KV logic).
- Write the new URL to **variant.image** (the single first variant for
  single-variant products — recommended default, decision point D1) AND
  insert a row into **`store_product_image`** AND sync **`product.image`** as
  legacy fallback.
- Pasted `imageUrl` goes through the same writes, except no KV upload.

**A.2 Admin gallery manager (on product edit page).**

- List existing `productImage` rows for the product with thumbnails.
- Actions per row: delete (row + optional KV blob), move up/down (`sortOrder`),
  replace via upload.
- Add-new-image-to-gallery action (upload appended at end of `sortOrder`).

**A.3 KV orphan policy (decision point D4, default documented).**

- Do NOT hard-delete KV blobs in this phase (immutable cache makes URLs
  permanent; URLs may be shared/re-used). Default: gallery row removal leaves
  the blob (audited in `docs/todo.md`), add a `/admin/media` "GC candidates"
  view listing keys no longer referenced by any product — owner one-click purge
  later.

**A.4 Sync the test that codifies the bug.**
Update `admin/products/[id]/page.spec.ts:471-485` to assert the NEW contract:
upload updates variant image + gallery + legacy cover.

**Quality gate A:** unit specs for the helper (file wins / pasted URL wins /
edit-without-image keeps existing), route spec for uploadImage + gallery
actions; `vp check` 0 errors, `vp test` green.

---

### Phase B — Upload UX: preview + drag & drop (Owner ask #2)

**Goal:** consistent, previewable, validated image upload everywhere.

**B.1 New shared `ImageUpload.svelte`** (`src/lib/components/admin/`), Svelte 5:

- Drag-and-drop zone + click-to-browse fallback; `dragover` visual state.
- **Client-side preview** via `URL.createObjectURL` before upload — for a file
  already stored (edit case) show the current image URL as the initial preview.
- Validation mirroring the server before submitting: type jpg/png/webp via file
  type, size ≤ 5MB (mirror `upload.ts:7,41`); inline error, submit disabled.
- Hidden `name`-able `input[type=file]` inside the parent form so existing
  `multipart/form-data` actions keep working (no JS-only dependency);
  `use:enhance` remains the submit path.
- Controller slot: emits `files` / `previewUrl` so product-edit can show which
  variant/gallery target is selected.

**B.2 Wire into every upload surface.**

- `products/[id]` cover upload (replaces the current separate form,
  `+page.svelte:83-101`), `ProductForm.svelte` file input
  (`ProductForm.svelte:167-187`), gallery manager (Phase A.2), product-new,
  variant image upload (new — replaces URL-only, `VariantEditor.svelte:101-111`).

**Quality gate B:** component spec (Svelte 5 test) for drag/drop state,
invalid-file rejection, preview lifecycle (± object-URL revocation); e2e covers
drag-drop upload in Phase F.

---

### Phase C — Global admin search (Owner ask #3)

**Goal:** every admin list is searchable by text, consistent URL pattern
`?q=` + existing filters.

| Route                         | Today                | Spec for this phase                                                                                                                |
| ----------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/products`             | `?q=` name/nameEn ✅ | keep; add `sku` to filter                                                                                                          |
| `/admin/orders`               | `?status=` only      | add `?q=` over order `number`, `email`, `name`, `phone` (LIKE with same escaping util as `buildNameFilter`, `products.ts:155-163`) |
| `/admin/categories`           | none                 | `?q=` name/nameEn + `?dept=` (honey/equipment) — `listCategoriesWithCounts({department})` already supports it                      |
| `/admin/users` (new, Phase D) | —                    | `?q=` name/email                                                                                                                   |
| `/admin/audit`                | none                 | `?q=` action/targetType/targetId                                                                                                   |
| Result feedback               | —                    | "X من النتائج" count + empty-state, used by all lists                                                                              |

**Not in scope:** full-text/score search — LIKE is fine for admin volumes;
Arabic normalization reuses `arabic.ts` if needed by the spec.

**Quality gate C:** service specs for each new filter (escaping, case,
Arabic), route load specs for param normalization + clamping (pattern from
`products/+page.server.ts:15-29`).

---

### Phase D — Complete CRUD + missing surfaces (Owner ask #4)

**D.1 Surface dormant product fields in ProductForm:**
`published` toggle (visible + archive action), `costPrice` (qirsh), `weightGrams`,
`sku`. Wire into `productWriteValues`/`getProductForEdit`.

**D.2 Users admin (`/admin/users`)** — build from existing schema
(`auth.schema.ts` `role`/`banned`/`banReason`/`banExpires`):

- List users (search from Phase C) with role + banned status.
- Promote/demote admin by email (feeds master-plan Phase 4.3), ban/unban with
  reason. Guards: never demote yourself, never ban the last admin.

**D.3 Products delete → KV GC note** (ties to A.3): on product delete
(`products/+page.server.ts:78-112`) delete `productImage` rows (already done in
`deleteProduct`) + record blob keys as GC candidates; keep 409-on-orders rule.

**D.4 Categories dept filter** in UI (service done, UI missing per 1.2).

**D.5 Orders completeness (scoped):** status lifecycle + emails stay as-is
(payments live in the other plan). Add only admin sales-ops gaps that don't
touch payment semantics: none blocking this plan; shipping-address edit defers
to the sales-ops plan's governorate work.

**Quality gate D:** route specs for users actions (guard math at edge cases),
product-form spec for the new fields; e2e smoke for users page.

---

### Phase E — Permissions (Owner ask #5)

**E.1 Single source of truth.** Extract `ADMIN_ROLES`/`isAdmin(user)` in
`src/lib/server/admin/`; keep `role === "admin"` semantics now, no behaviour
change.

**E.2 Close load-guard gaps.** Dashboard, orders list/detail, audit, funnels,
categories, products list/edit `load`s currently rely on the layout guard only
(safe for GETs, but list them explicitly and add the re-check on any route that
will gain a POST in Phases A–D).

**E.3 Granular roles (decision point D3, default = defer).** Default: keep a
single `admin` role this plan; spec decides `moderator` only if owner wants
review moderation separation (master-plan Phase 3.4). The infrastructure
(role constants + per-action checks) is laid so adding roles later is a config
change, not a refactor.

**Quality gate E:** guard spec covering layout + every action + server
endpoints (403 vs redirect), consistent with existing tests
(`admin-guard.e2e.ts`).

---

### Phase F — Confirmation & tests that everything works (Owner ask #6)

**F.1 Test matrix (the "كل حاجة شغالة" gate).**

| Behaviour                                                                      | Test layer                  | Covers      |
| ------------------------------------------------------------------------------ | --------------------------- | ----------- |
| Upload → storefront card + gallery + detail show the new image                 | e2e Playwright              | A (the bug) |
| Drag-drop + preview + rejection of bad file/size                               | component spec              | B           |
| Search each admin list returns expected subset                                 | route spec + e2e smoke      | C           |
| Full edit of every element (products/users/categories/orders/variants/gallery) | route spec + e2e smoke      | D           |
| Permission guard: non-admin blocked on load + every POST + server endpoint     | spec + `admin-guard.e2e.ts` | E           |
| Regression: `vp check` 0 errors, `vp test` green, `vp build` clean             | CI/local                    | global      |

**F.2 e2e new scenario (playwright):** admin edits product image via the new
component (drop a fixture file), then asserts: product card thumbnail =
new URL, gallery first image = new URL, `/media/<uuid>` returns `image/*` 200. This is the direct regression test for the reported bug.

---

## Part 3 — Decision points for owner (resolve before the relevant phase)

| ID  | Decision                                                     | Recommended default                                           | Blocked by |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------- | ---------- |
| D1  | Cover upload: auto-write to the (single) variant image?      | Yes — store model is one variant per product (2026-08-14 ADR) | Phase A    |
| D2  | Keep legacy `product.image` in sync, or stop writing it?     | Keep syncing (SEO/fallback; cards use `?? product.image`)     | Phase A    |
| D3  | Granular roles now (admin + moderator) or later?             | Later — infra only this plan                                  | Phase E    |
| D4  | KV blob GC on replace/delete: hard purge or candidates list? | Candidates list first, one-click purge later                  | Phase A/D  |

## Part 4 — Ticket breakout (first cut, to `docs/todo.md` on approval)

- [ ] A: product-images helper + uploadImage/details rewrite + gallery actions (`products/[id]`)
- [ ] A: gallery manager UI (product edit page)
- [ ] A: update codifying image spec test
- [ ] B: `ImageUpload.svelte` + wire cover/form/variant/gallery
- [ ] C: orders search, categories search+dept, audit search, product sku
- [ ] D: published/costPrice/weightGrams/sku in ProductForm
- [ ] D: `/admin/users` page + promote/demote/ban + guard edge cases
- [ ] D: categories dept filter UI + delete→GC-candidate recording
- [ ] E: role constant + isAdmin + load-guard gap close
- [ ] F: e2e image scenario + search/e2e smokes + global gate run

## Measures of success (global gate)

- Changing a product image in admin updates flat listing card, product detail
  gallery, and the product edit page — verified by an automated e2e.
- Image upload is preview + drag-drop with client validation matching the server.
- Every admin list responds to text search; every element is editable from
  admin; users are manageable; permissions are enforced on every load + action.
- `vp check` 0 errors, `vp test` green, `vp build` clean, e2e green.
