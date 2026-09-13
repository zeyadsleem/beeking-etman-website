# Data Integrity Hardening — Design Spec

- **Date:** 2026-09-13
- **Status:** Proposed (design only — this document changes no code, config, or migrations)
- **Author:** architecture pass
- **Scope:** order `status` default, catalog-authority completion, inventory precision
  (REAL kg → INTEGER grams), movement unit normalization, defense-in-depth CHECKs/triggers,
  shared status constants.
- **Explicitly not in scope:** the payments state machine (sibling spec
  `2026-09-13-order-lifecycle-payments-design.md`, "spec B" below).
- **Roadmap:** `docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md` is
  authoritative for cross-spec arbitration (migration numbering, single ownership); D1/D2/D4 and
  the staged D3 file are frozen there.
- **Sibling specs (same date, must be implemented with awareness of each other):**
  `docs/superpowers/specs/2026-09-13-order-lifecycle-payments-design.md` (Paymob, status
  vocabulary, migration numbering), `docs/superpowers/specs/2026-09-13-ops-security-hardening-design.md`
  (`/api/health` version, backup/restore, observability), `docs/superpowers/specs/2026-09-13-email-delivery-pipeline-design.md`
  (outbox worker; no schema overlap with this spec), `docs/superpowers/specs/2026-09-13-commerce-parity-design.md`
  (returns restock through stock adjustments; owns `reason_code` service/UI).
- **Related records:** `docs/decisions.md` 2026-09-09 (order hardening, catalog bridge),
  `docs/todo.md` §"Remaining (non-blocking)", `docs/architecture.md` §D1 module map.

---

## 1. Context & current state

### 1.1 Verified production state (read-only queries, 2026-09-13)

D1 `beeking` (`93fc332c-83b9-4cc0-abbc-5b08d5ccfbbc`) is at `0017_catalog_authority` and
contains **zero rows** in every table this spec touches except the catalog:

| Table                                                                                                                                                   | Rows                        | Consequence                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `store_order`                                                                                                                                           | 0                           | `paid`→`placed` backfill and `store_order` recreate are data-free in production today                                                        |
| `store_batch`, `store_stock_conversion`, `store_stock_movement`, `store_transfer`, `store_transfer_item`, `store_packaging_material`, `store_warehouse` | 0 each                      | kg→grams conversion has no production rounding decisions to make                                                                             |
| `store_product` rows with legacy `image <> ''`                                                                                                          | 191                         | bridge backfill already populated `store_product_image` (561 rows)                                                                           |
| `store_product_variant`                                                                                                                                 | 191 products / 191 variants | variant remains the runtime price/stock/image authority; the two-storefront catalog expansion (commits `e4c9cfe`, `59662fa`) is already live |

Implication: production risk for the schema-conversion work is near zero; replay/fixture
correctness and local/dev databases are where the conversion logic must be proven.

### 1.2 Invariant audit

Legend: ✅ enforced, ⚠️ partial, ❌ missing.

**Orders**

| Invariant                                            | Current enforcement                                                                                                                                                                                         | Gap                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New orders are born in a non-payment lifecycle state | Runtime writes `status: "placed"` (`src/lib/server/orders.ts:337`)                                                                                                                                          | Column default is `'paid'` (`schema.ts:110`, `drizzle/0000_fast_cammi.sql:17`) — any insert omitting `status` silently becomes paid. The 8 fixture DDLs already say `DEFAULT 'placed'` (see §1.6), so code and fixtures disagree with the schema ⚠️ |
| Legacy `paid` rows display as `placed`               | `parseOrderStatus` (`src/lib/admin-order-status.ts:8-11`); admin `placed` filter matches both (`src/lib/server/admin/orders.ts:85-87`); stats skip unknown values (`src/lib/server/admin/stats.ts:110-117`) | Backfill never ran (intentional, `docs/decisions.md:1370`); hardcoded `["placed","paid"]` duplicates vocabulary; `toOrderStatus` throws on any other stored value (`admin/orders.ts:40-47`) ❌                                                      |
| `stock_version` is a closed vocabulary               | Runtime writes `'atomic'` (`orders.ts:339`); default `'legacy'` (`schema.ts:112`)                                                                                                                           | Free text; no CHECK; a typo disables reservation or crash-loops cancel paths ❌                                                                                                                                                                     |
| Order item quantity/price sane                       | 0016 table-recreate CHECKs (`drizzle/0016_order_hardening.sql:10-11`) + triggers (`:24-57`)                                                                                                                 | ✅ (spec fixtures replicate; see §1.6)                                                                                                                                                                                                              |
| Stock cannot go negative                             | `trg_product_variant_stock_non_negative` (`0016:52-57`)                                                                                                                                                     | ✅                                                                                                                                                                                                                                                  |
| Cancel restocks exactly once                         | `trg_order_status_cancel_restock` gated on `stock_version='atomic'` (`0016:58-69`); legacy rows restocked by service SQL                                                                                    | ✅ — but rewriting legacy rows to `atomic` before their reservation mechanism is retired would double-adjust stock; backfill must not touch `stock_version`                                                                                         |
| Status vocabulary is single-sourced                  | `ORDER_STATUSES` + `STATUS_ORDER` (`admin-order-status.ts:3,24`), email labels (`email.ts:517-522`), hardcoded pair (`admin/orders.ts:86`)                                                                  | Three copies; no type for `stockVersion`/stored `paid` ⚠️                                                                                                                                                                                           |

**Catalog**

| Invariant                                                    | Current enforcement                                                                                                                                                                                                                               | Gap                                                                                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime never reads/writes `store_product.price/stock/image` | Verified by grep: no non-spec reference to `schema.product.price/stock/image` remains; images come from `productImage` + `productVariant.image` (`store.ts:136,235-236,678`; `admin/products.ts:206`; `setCoverUrl`, `product-images.ts:106-135`) | Columns physically exist (`schema.ts:34-40`); `docs/todo.md:341-350` still describes them as active (stale) ⚠️                                                                 |
| Old-build cover writes reach the gallery during overlap      | `0017_catalog_authority.sql:8-25` bridge triggers                                                                                                                                                                                                 | Bridge is temporary by design; staged drop not in journal (`migration-replay.spec.ts:178-185`) ⚠️                                                                              |
| Seed tooling works after the drop                            | `scripts/export-d1-seed.ts:34` excludes values and `:57` emits `0`/`''` placeholders                                                                                                                                                              | INSERT column list still names `price, stock, image` (`export-d1-seed.ts:99-121`) and committed `d1-seed.sql` does the same — both break the moment the columns are dropped ❌ |
| Cover authority is defined                                   | `setCoverUrl` keeps `store_product_image` sort order and mirrors single-variant covers                                                                                                                                                            | Multi-variant products have no explicit "primary cover" flag; cover = lowest `sort_order` (implicit contract) ⚠️                                                               |

**Inventory**

| Invariant                                       | Current enforcement                                                                                                                                              | Gap                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Honey mass is exact                             | None — `REAL` columns (`schema.ts:238-239,276`)                                                                                                                  | Binary floating point; see §1.3 ❌                                                                                              |
| Mass unit is unambiguous                        | Comment only: "honey mass (kg) as `real`" (`admin/inventory.ts:10`); movements for batches are written in **grams** (`inventory.ts:301`)                         | Same batch exists as kg in `store_batch` and grams in `store_stock_movement`; transfer items are plain integers with no unit ❌ |
| Batch remaining is non-negative                 | `CASE WHEN quantity_kg >= used THEN quantity_kg - used ELSE NULL` + `NOT NULL` (`inventory.ts:269-270`)                                                          | Indirect; depends on the NOT NULL trick; no CHECK; only covers the conversion path ⚠️                                           |
| `initial >= quantity`, `expiry > harvest`       | None (no batch create UI exists — routes are only `alerts/`, `reports/`, `transfers/`, `warehouses/`)                                                            | Direct SQL can store impossible batches ❌                                                                                      |
| Conversion spends only positive amounts         | Service validation (`inventory.ts:215-218`)                                                                                                                      | No DB constraint; `units_produced = 0` or negative raw slips through any non-service write ❌                                   |
| Packaging stock never negative                  | `CASE ... ELSE NULL` + `NOT NULL` (`inventory.ts:282-283`)                                                                                                       | Same indirect pattern; `reorder_point`/`cost_per_unit` unchecked ⚠️                                                             |
| Movement quantities carry a unit                | Convention: `itemType='batch'` ⇒ grams, `variant                                                                                                                 | material` ⇒ units (`inventory.ts:296-315`; test encodes it at `inventory.spec.ts:70-73`)                                        | Column named `quantity`; no `unit`; `quantity = 0` allowed; `item_id` has no FK ❌ |
| Transfer endpoints differ                       | Service (`inventory.ts:418`) + form refine (`transfers/+page.server.ts:48`)                                                                                      | No DB CHECK ❌                                                                                                                  |
| Transfer items are positive                     | Service (`inventory.ts:421-423`) + zod (`transfers/+page.server.ts:46`)                                                                                          | No DB CHECK ❌                                                                                                                  |
| Transfer completion is atomic (status + ledger) | Status flip batch (`inventory.ts:573-584`) then a **second** batch writes movement rows (`:586-623`); a failure after the flip leaves `completed` with no ledger | Two transactions ❌                                                                                                             |
| Warehouse type is valid                         | Fallback coercion on read (`inventory.ts:36-38,44`)                                                                                                              | Invalid stored value silently becomes `fulfillment`; no CHECK ❌                                                                |

### 1.3 Float precision in inventory (concrete examples)

`store_batch.quantity_kg REAL` + arithmetic in SQL and JS:

- `0.1 + 0.2 = 0.30000000000000004`. A batch created as 30 kg and spent in 0.1 kg
  increments accumulates visible residue; `SUM(quantity_kg)` over batches can drift from the
  movement ledger.
- `BATCH_LOW_SHARE` compares floats (`inventory.ts:124,147`): `quantityKg <=
initialQuantityKg * 0.2` is not an exact threshold.
- Alert payloads already smuggle grams through the float: `Math.round(row.quantityKg * 1000)`
  (`inventory.ts:131,152`) while the label stays `${quantityKg} kg` (`:132,153`).
- The ledger rounds and the balance does not: conversion subtracts full `rawKgsUsed`
  from `quantity_kg` (`:269-270`) but stores `-Math.round(rawKgsUsed * 1000)` grams
  (`:301`). Per conversion the drift is ≤0.5 g, but it is unbounded over many conversions and
  is currently invisible.
- JS `number` is IEEE-754 double; "0.3 kg" cannot be represented exactly. Integer grams
  can, up to 2^53.

### 1.4 Dual-authority order status

- Schema default: `'paid'` (`schema.ts:110`).
- Runtime write: `'placed'` (`orders.ts:337`).
- Fixtures: `status TEXT NOT NULL DEFAULT 'placed'` in 8 spec files (§1.6).
- Legacy `paid` still accepted by `parseOrderStatus` and the admin filter.
- Spec B plans to replace this vocabulary entirely
  (`pending_payment|paid|processing|shipped|delivered|cancelled`, `placed` as a legacy read
  alias — `2026-09-13-order-lifecycle-payments-design.md` §3.1.1); the physical default alignment
  is data-integrity D1's single rebuild, conditional per the roadmap (folded into B's `0019` when
  payments lands first, `0021_order_status_default.sql` otherwise).
- `stats.spec.ts:291` inserts `status: "refunded"` to prove stats tolerate unknown values —
  evidence that B will widen this vocabulary. Nothing here may add a `CHECK` on `order.status`.

### 1.5 Deprecated catalog columns

`schema.ts:34-40` still declares `price`, `stock`, `image`; snapshot `0017` still lists them;
`drizzle/staged/0017_drop_legacy_product_columns.sql` (`DROP TRIGGER IF EXISTS` ×2 +
`ALTER TABLE ... DROP COLUMN` ×3) is outside the journal and must run manually only after old
instances are drained (`docs/todo.md:468-476`). The bridge triggers copy old-app cover writes
into `store_product_image` (`0017_catalog_authority.sql:8-25`). No runtime code depends on the
columns (verified grep), but two tooling paths still emit them (§1.2).

### 1.6 Embedded DDL inventory (must stay in sync)

| Kind                            | Files                                                                                                                                                                                                                                                                                                | State                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `CREATE TABLE store_order`      | 9 spec files: `admin/orders.spec.ts:67`, `admin/products.spec.ts:82`, `admin/stats.spec.ts:67`, `db/migration-replay.spec.ts:88`, `orders.spec.ts:51`, `admin/orders/[id]/page.spec.ts:49`, `admin/orders/page.load.spec.ts:44`, `admin/page.load.spec.ts:79`, `admin/products/page.load.spec.ts:80` | 8 declare `DEFAULT 'placed'`; `migration-replay.spec.ts:94` intentionally declares `'paid'` as the pre-0016 legacy fixture |
| `CREATE TABLE store_order_item` | 9 spec files (same set + `admin/products/[id]/page.spec.ts:91`, minus none)                                                                                                                                                                                                                          | Mirrors 0016 CHECKs                                                                                                        |
| Inventory DDL                   | `admin/inventory.spec.ts:23-27`                                                                                                                                                                                                                                                                      | `quantity_kg REAL`, `raw_kgs_used REAL`, movement `quantity INTEGER` — must be rewritten by this work                      |
| Migration replay                | `migration-replay.spec.ts:19-46` applies only `0016` statement-by-statement in autocommit; CI separately runs the full `drizzle-kit migrate` chain (`ci.yml` test job)                                                                                                                               | New parent-table rebuilds need a transactional apply helper (§5)                                                           |

The task brief said "8 spec files"; the verified count is 9 containing `store_order` DDL
(8 × `'placed'` + 1 legacy `'paid'`), plus `products/[id]/page.spec.ts` containing only the
`order_item` DDL.

---

## 2. Goals / Non-goals

### 2.1 Goals

1. Make the order `status` column default safe — an omitted-status insert can never
   masquerade as a paid order (`'placed'` pre-B, `'pending_payment'` if B's migration has
   landed; see §3.1 sequencing).
2. Finish the catalog-authority migration: drain verification, journal-tracked column drop,
   tooling/schema cleanup, no dangling references.
3. Replace REAL kg with INTEGER grams in batch/conversion tables, with exact conversion SQL,
   reconciliation evidence, and rounding policy.
4. Give the stock ledger explicit units and enforce the canonical unit per item type.
5. Add DB-level CHECKs/triggers so every invariant the services rely on survives direct SQL,
   plus close the `completeTransfer` two-transaction hole.
6. Consolidate order-status/stock-version vocabulary in one client/server-safe module.

### 2.2 Non-goals

- **Payments state machine** — statuses, transitions, `payment_status` values, webhook
  idempotency, refunds, and the at-order-vs-at-payment stock decision all belong to payments
  spec B (`docs/todo.md:99-109`).
- **Catalog feature work** — SKU uniqueness, storefront `published` enforcement, `salePrice`,
  variant-level weight, pricing import (`docs/todo.md:61-79`) are commerce-spec territory (COM §3h);
  the two-storefront expansion itself is already shipped (commits `e4c9cfe`, `59662fa`). This spec
  only completes the legacy-column drain (D4, `0023`).
- **Unshipped feature tables** (`store_return`/`store_review`/`store_coupon`) — removed from
  the schema on 2026-09-09 (`docs/decisions.md:1493`); physical tables are left alone.
- **Movement FK to `item_id`** — polymorphic, cannot be a real FK; a validation trigger is
  the pragmatic ceiling (§3.5).
- Payment gateway, email, SEO, UI redesign.

### 2.3 Boundary contract with payments spec B

Spec B (`2026-09-13-order-lifecycle-payments-design.md`) makes concrete choices this spec must
not contradict or duplicate:

- B replaces the vocabulary: `pending_payment|paid|processing|shipped|delivered|cancelled`,
  with `placed` demoted to a legacy alias for `paid` on read (B §3.1.1), and plans the
  application-facing `store_order.status` default as `pending_payment` (B §4.4). B explicitly
  **defers the physical default alignment** to a post-drain rebuild because it judges the
  parent-table rebuild not worth the risk during old-instance overlap (B §4.4).
- B's migration (`0019_payments`, B §4.1) adds columns/tables, recreates
  `trg_order_status_cancel_restock` with an `OLD.status` allowlist, and creates
  `trg_order_payment_values_valid` + `trg_order_payment_consistency` **on `store_order`**.
- B owns any CHECK/trigger on `status`/`payment_status`, sale-side stock semantics, and the
  reserve/expire/restock behavior (B §3.2 keeps reserve-at-placement).

**This spec's contract:**

1. **Safe default, sequenced.** D1 is the single `store_order` rebuild. If payments has not been
   applied, D1 ships as `0021_order_status_default.sql` with the pre-payments default `'placed'`
   (the current runtime value, already encoded in 8 fixture DDLs). When payments is applied (or
   lands first), D1's rebuild content is folded into B's `0019_payments` once, uses B's application
   default `pending_payment`, and only completes constraints (`ck_order_stock_version`, trigger
   capture/recreate); `0021` is never created. Either way the requirement "an insert omitting
   `status` can never look paid" is met, and B never inherits a `'paid'` physical default.
2. **Trigger preservation.** Any rebuild of `store_order` must recreate **every** trigger
   attached to it, whatever the journal defines at implementation time (0016's
   cancel-restock, plus B's two payment triggers if `0019_payments` is applied). Use
   `SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='store_order'` as
   the source of truth — never hardcode 0016's body (§3.1, §4.3).
3. **`stock_version` unchanged.** B keeps the field (reserve-at-placement, B §3.2). This spec
   adds the `atomic|legacy` CHECK; if B ever retires the legacy value, B adjusts the CHECK.
4. **Movement units B-ready.** B may add `type='sale'` movement rows later; the normalized
   movement schema (§3.4) supports that without another rebuild. This spec does not write
   sales rows (open decision 6).
5. **Shared constants.** B rewrites the status vocabulary and its consumers (B §3.1.1 lists
   `admin-order-status.ts`, `email.ts:517-522`, invoice, export, stats, i18n, 8 DDL copies).
   The `ORDER_STATUS_META` consolidation in §3.6 gives B a single edit point; the module already
   exists in the repo (`src/lib/admin-order-status.ts`, name unchanged), and whichever spec
   lands first performs the consolidation.
6. **Migration numbering is frozen by the roadmap.** B takes `0019_payments` after EM's
   `0018_email_delivery.sql`; ops takes `0020_email_verified_backfill.sql`; this spec's D1/D2/D4
   take `0021`/`0022`/`0023` and D3 stays the staged `after_drain_status_backfill.sql`. D1 is
   conditional (§3.1); no file is renumbered after it lands on `main` (§4.1).
7. This spec must **not** add a status CHECK: B's value triggers own that, and
   `stats.spec.ts:291` already stores `refunded`.

---

## 3. Proposed design

### 3.1 (a) Safe order status default

**Decision (sequenced with B; see §2.3).** Rebuild `store_order` so an insert omitting
`status` can never look paid:

- **If payments has not been applied**: ship `0021_order_status_default.sql` with
  `status TEXT NOT NULL DEFAULT 'placed'` (today's runtime value, already encoded in 8 fixture
  DDLs) + `CHECK (stock_version IN ('atomic','legacy'))`. `schema.ts:110` becomes
  `.default("placed")`. Keep the current `parseOrderStatus`.
- **If B's `0019_payments` is applied (or payments lands first)**: do not write `'placed'`; D1's
  rebuild content is folded into `0019_payments` and uses B's application default
  `pending_payment`, completing constraints only (`ck_order_stock_version` + trigger
  capture/recreate), because `placed` is then only a legacy read alias (B §3.1.1, §4.4). In both
  cases the `stock_version` CHECK is unchanged work.

The `paid`→`placed` data backfill (B-world: no backfill needed; B keeps stored values and
reads through the alias, B §3.1.1/§4.1 item 7) stays a separate after-drain script, never in
the same migration as the rebuild.

**Why this is safe during old-instance overlap.** The default is observable only to inserts
that omit `status`; the live pre-hardening build wrote `status: "paid"` explicitly (verified
at `d9a6eb9^:src/lib/server/orders.ts:250`), so it cannot be affected by a default change.
New builds write explicitly too. The rebuild keeps every existing row value verbatim.

**Rejected alternatives.**

- _No default (`status TEXT NOT NULL`)_: fails loudly on omitted inserts, but breaks
  tooling/fixtures that rely on a default and has no upside once a safe default exists.
- _BEFORE INSERT trigger rewriting NULL_: impossible — SQLite applies column defaults before
  BEFORE triggers and cannot assign `NEW.*`.
- _Leave `'paid'` and rely on runtime writes_: keeps a live foot-gun; violates the
  "safe default" requirement.

**Migration sketch** (`0021_order_status_default.sql`, roadmap-frozen; generated by
`drizzle-kit generate --name order_status_default` then hand-edited; when `0019_payments` is
applied this content folds into it and `0021` is never created — substitute `pending_payment`
for `placed`):

```sql
PRAGMA defer_foreign_keys = true;
--> statement-breakpoint
CREATE TABLE `__new_store_order` (
  `id` text PRIMARY KEY NOT NULL,
  `number` text NOT NULL,
  `nonce` text,
  `email` text NOT NULL,
  `name` text NOT NULL,
  `phone` text NOT NULL,
  `address` text NOT NULL,
  `city` text NOT NULL,
  `governorate` text NOT NULL DEFAULT 'cairo',
  `shipping_cost` integer NOT NULL DEFAULT 0,
  `total` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'placed',          -- 'pending_payment' after B
  `payment_status` text NOT NULL DEFAULT 'simulated',
  `stock_version` text NOT NULL DEFAULT 'legacy',
  `user_id` text,
  `created_at` integer NOT NULL,
  CONSTRAINT `ck_order_stock_version` CHECK (`stock_version` IN ('atomic','legacy'))
  -- B-first additionally carries B's new columns (payment_provider, payment_expires_at,
  -- paid_at, provider_intention_id) and any B-added CHECKs.
);
--> statement-breakpoint
INSERT INTO `__new_store_order`
  (`id`,`number`,`nonce`,`email`,`name`,`phone`,`address`,`city`,`governorate`,`shipping_cost`,`total`,`status`,`payment_status`,`stock_version`,`user_id`,`created_at`)
-- B-first: B's four added columns are omitted here on purpose; they take their schema defaults
-- (payment_provider='none', the rest NULL) for pre-existing rows, matching B's no-backfill rule.
SELECT
  `id`,`number`,`nonce`,`email`,`name`,`phone`,`address`,`city`,`governorate`,`shipping_cost`,`total`,`status`,`payment_status`,`stock_version`,`user_id`,`created_at`
FROM `store_order`;
--> statement-breakpoint
DROP TABLE `store_order`;
--> statement-breakpoint
ALTER TABLE `__new_store_order` RENAME TO `store_order`;
--> statement-breakpoint
CREATE UNIQUE INDEX `store_order_number_unique` ON `store_order` (`number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_order_nonce_unique` ON `store_order` (`nonce`);
--> statement-breakpoint
CREATE INDEX `store_order_userId_createdAt_idx` ON `store_order` (`user_id`,`created_at`);
--> statement-breakpoint
-- Recreate EVERY trigger captured from the live schema before the rebuild
-- (SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='store_order');
-- 0016-only world: trg_order_status_cancel_restock (0016:58-69 verbatim).
-- B-first world: cancel-restock with B's OLD.status allowlist + trg_order_payment_values_valid
-- + trg_order_payment_consistency (B §4.1 items 5-6), copied verbatim, never paraphrased.
```

Notes:

- The index names are the existing ones (`drizzle/0000_fast_cammi.sql:22`,
  `drizzle/0002_true_venus.sql:9-10`, `drizzle/0006_small_the_liberteens.sql:1`).
- **Trigger capture is the critical B-coordination step**: `DROP TABLE store_order` drops all
  triggers attached to it, including B's payment guards if `0019_payments` ran first. Capture
  `sqlite_master.sql` for each and re-execute it after the rename. This is why the migration
  is hand-edited, not merged from a generated diff.
- The order-item triggers only _reference_ `store_order` and survive the rename.
- Child tables (`store_order_item`, and the orphaned `store_return` where 0014 ran) reference
  `store_order`; `PRAGMA defer_foreign_keys = true` lets the drop/rename happen inside the
  migration transaction and re-validates at commit. Do **not** use drizzle-kit's generated
  `PRAGMA foreign_keys=OFF` — it is a no-op inside a transaction (SQLite semantics; D1
  explicitly recommends `defer_foreign_keys`, see `developers.cloudflare.com/d1/reference/migrations/`).
- `INSERT ... SELECT` lists columns explicitly (never `SELECT *`).

**After-drain stage** (`drizzle/staged/after_drain_status_backfill.sql`, §4.1; only meaningful
in the pre-B world):

```sql
-- Idempotent. Run only after drain evidence (§3.2). Do NOT touch stock_version:
-- legacy rows were reserved by the old service path and must keep their mechanism.
UPDATE store_order SET status = 'placed' WHERE status = 'paid';
```

Payments-first: no `paid`→`placed` backfill (B §4.1 item 7); D3 is pre-payments-only and
superseded once payments lands, at which point PAY's owned post-drain cleanup rewrites
`placed`→`paid` instead (B §4.2 stage 2).

**Spec-fixture sync.** Pre-B, the 8 fixtures already say `'placed'`; add the
`ck_order_stock_version` CHECK to them for parity with production DDL. Keep
`migration-replay.spec.ts:94` at `'paid'` (it models the pre-0016 schema on purpose). B-first,
the fixtures already carry B's four columns/triggers and the `'pending_payment'` default
(B §5.2); this spec only adds the stock-version CHECK assertion.

### 3.2 (b) Catalog authority completion

**Decision.** Do not apply the staged drop ad hoc. Once drain is evidenced, promote the same
SQL into the journal as `drizzle/0023_drop_legacy_product_columns.sql` (roadmap-frozen), ship it
in the _next_ release after the drain-evidence release, and only then remove the columns from
`schema.ts` and from seed tooling. Keep `drizzle/staged/0017_drop_legacy_product_columns.sql`
as the emergency manual copy.

**Why a journal migration instead of a manual applied file.** The moment `schema.ts` stops
declaring the columns, CI's `drizzle-kit migrate` and e2e's migration replay create them on
fresh databases while `scripts/export-d1-seed.ts` no longer populates them — and
`store_product.price`/`image` are `NOT NULL` with **no database default** (`0000:39,41`; the
`$defaultFn` in `schema.ts:34-40` is JS-side only). Seed imports would fail. The drop must
therefore exist in the migration chain everywhere, not only in production. CI order
(`.github/workflows/ci.yml`: test → migrate-production → deploy-production) guarantees the
migration is applied while the _live_ build is the already-clean drained build, so the
migrate→deploy window is safe.

**Drain verification procedure** (all read-only):

1. **Revision evidence (primary)** — the ops spec
   (`2026-09-13-ops-security-hardening-design.md` §3.5.1-3.5.2) adds `version` (commit SHA) to
   `/api/health` and a `verify-production` CI job that requires `version === github.sha`.
   For a staged drop, poll `/api/health` on the production origin and require the returned SHA
   to equal the **expected clean build's SHA**, i.e., a commit after the 2026-09-09 cleanup
   that removed all `schema.product.price/stock/image` references. Record the first timestamp
   at which the clean SHA is served as cutover `T`. If the health-version field has not
   shipped yet, fall back to `wrangler pages deployment list --project-name
beeking-etman-website` (active deployment id/commit), which the ops spec also surfaces.
2. **Data canary (secondary)** — legacy columns can only change if an old build writes them.
   Capture the checksum before and after a 24 h window post-`T`:
   ```sql
   SELECT count(*) AS n, coalesce(sum(length(image)), 0) AS chars
   FROM store_product WHERE image <> '';
   ```
   Unchanged checksum + clean SHA served past `T` ⇒ drained. (Production currently reports
   `n=191`.)
3. **Optional telemetry** — query Workers Observability for requests attributed to the prior
   script version. The `$metadata` key availability for Pages deployments was **not**
   verified during this design (`observability_keys` returned no data; API reported
   unavailable), and the ops spec §3.8 owns log enablement — treat this as a bonus signal,
   never the primary one.

**Procedure after evidence** (runbook material, to be added to
`docs/production-runbook.md` at implementation time):

1. `wrangler d1 export beeking --remote --output=pre-drop.sql` (backup; Time Travel also
   retains 7 days on Free).
2. `pnpm exec drizzle-kit generate --name drop_legacy_product_columns`; hand-edit to the
   staged SQL (drop 2 bridge triggers, `DROP COLUMN` ×3). Removes the columns from
   `schema.ts`.
3. Merge and let CI apply the drop migration (0023), then deploy the build with the cleanup.
4. Post-drop verification:
   ```sql
   SELECT name FROM pragma_table_info('store_product');
   SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'store_product_legacy%';
   SELECT count(*) FROM store_product_image; -- must still be 561 in production
   ```
   plus smoke: storefront product detail renders gallery, admin product edit + image upload
   works, `pnpm d1:seed` import succeeds.
5. Code cleanup in the same release:
   - `schema.ts:34-40` remove `price`/`stock`/`image`;
   - `scripts/export-d1-seed.ts` remove them from the SELECT literal list (`:57`) and the
     INSERT column list (`:99-121`);
   - regenerate `d1-seed.sql` (`pnpm db:seed:d1`) and remove `price, stock, image` from the
     committed fixture;
   - grep gate: `rg 'schema\.product\.(price|stock|image)' src scripts` must return nothing.
6. Delete or annotate the staged file (the journal owns the change from now on).

**Follow-ups (not blockers).**

- `store_product_variant.image` stays the per-variant card image; product cover remains "the
  gallery row with the lowest `sort_order`" (written by `setCoverUrl`, `product-images.ts:106-135`).
  Document this as the cover contract in `docs/architecture.md`; add a `UNIQUE(product_id, url)`
  gallery constraint only if duplicates are observed (none now; bridge dedups by `NOT EXISTS`).
- Until the drop migration ships, `drizzle-kit generate` output must be reviewed against the staged-drop
  note (`docs/decisions.md:1491`).

### 3.3 (c) Inventory precision: REAL kg → INTEGER grams

**Decision.** Convert to **integer grams**, not milligrams.

Rationale:

- `weightGrams` is already the project's mass unit name (`schema.ts:52`; currently unused, so
  the naming convention is established without a competing consumer).
- The system already converts to grams at the ledger/alerts boundaries:
  `Math.round(rawKgsUsed * 1000)` (`inventory.ts:301`) and
  `Math.round(quantityKg * 1000)` (`inventory.ts:131,152`).
- Retail granularity is 150 g / 250 g / 500 g / 1 kg (`scripts/seed.ts` variants). 1 g
  precision exceeds business need; milligrams would triple every stored number, invite
  off-by-1000 bugs, and provide no consumer.
- Both fit `2^53`; grams give ~9×10^12 kg headroom, effectively unbounded for this business.

**Column map (physical, snake_case):**

| Old                                 | New                                       | Table                    |
| ----------------------------------- | ----------------------------------------- | ------------------------ |
| `initial_quantity_kg REAL NOT NULL` | `initial_quantity_grams INTEGER NOT NULL` | `store_batch`            |
| `quantity_kg REAL NOT NULL`         | `quantity_grams INTEGER NOT NULL`         | `store_batch`            |
| `raw_kgs_used REAL NOT NULL`        | `raw_grams_used INTEGER NOT NULL`         | `store_stock_conversion` |

**Rounding policy.** `CAST(ROUND(x * 1000) AS INTEGER)`: nearest gram, halves away from zero
(SQLite `ROUND`). No truncation (`CAST` alone floors toward zero). Loss per value ≤ 0.5 g.
The same expression is used in migration SQL, reconciliation, and tests so there is exactly
one definition.

**Conversion SQL sketch** (`store_batch`; `store_stock_conversion` follows the same pattern):

```sql
PRAGMA defer_foreign_keys = true;
--> statement-breakpoint
CREATE TABLE `_migration_inventory_batch_expected` AS
SELECT `id`,
       CAST(ROUND(`initial_quantity_kg` * 1000) AS INTEGER) AS `initial_grams`,
       CAST(ROUND(`quantity_kg` * 1000) AS INTEGER) AS `quantity_grams`
FROM `store_batch`;
--> statement-breakpoint
CREATE TABLE `__new_store_batch` (
  `id` text PRIMARY KEY NOT NULL,
  `batch_number` text NOT NULL,
  `product_id` text NOT NULL REFERENCES `store_product`(`id`),
  `season_name` text NOT NULL,
  `season_name_en` text NOT NULL DEFAULT '',
  `apiary_source` text NOT NULL DEFAULT '',
  `harvest_date` integer NOT NULL,
  `expiry_date` integer NOT NULL,
  `lab_cert_url` text,
  `qr_code` text,
  `initial_quantity_grams` integer NOT NULL,
  `quantity_grams` integer NOT NULL,
  `notes` text,
  `created_at` integer NOT NULL,
  CONSTRAINT `ck_batch_expiry_after_harvest` CHECK (`expiry_date` > `harvest_date`),
  CONSTRAINT `ck_batch_initial_non_negative` CHECK (`initial_quantity_grams` >= 0),
  CONSTRAINT `ck_batch_quantity_non_negative` CHECK (`quantity_grams` >= 0),
  CONSTRAINT `ck_batch_quantity_within_initial` CHECK (`quantity_grams` <= `initial_quantity_grams`),
  CONSTRAINT `ck_batch_grams_integer` CHECK (typeof(`initial_quantity_grams`) = 'integer' AND typeof(`quantity_grams`) = 'integer')
);
--> statement-breakpoint
INSERT INTO `__new_store_batch`
  (`id`,`batch_number`,`product_id`,`season_name`,`season_name_en`,`apiary_source`,`harvest_date`,`expiry_date`,`lab_cert_url`,`qr_code`,`initial_quantity_grams`,`quantity_grams`,`notes`,`created_at`)
SELECT b.`id`, b.`batch_number`, b.`product_id`, b.`season_name`, b.`season_name_en`, b.`apiary_source`,
       b.`harvest_date`, b.`expiry_date`, b.`lab_cert_url`, b.`qr_code`,
       e.`initial_grams`, e.`quantity_grams`, b.`notes`, b.`created_at`
FROM `store_batch` b JOIN `_migration_inventory_batch_expected` e ON e.`id` = b.`id`;
--> statement-breakpoint
DROP TABLE `store_batch`;
--> statement-breakpoint
ALTER TABLE `__new_store_batch` RENAME TO `store_batch`;
--> statement-breakpoint
CREATE UNIQUE INDEX `store_batch_batch_number_unique` ON `store_batch` (`batch_number`);
--> statement-breakpoint
CREATE INDEX `store_batch_productId_idx` ON `store_batch` (`product_id`);
--> statement-breakpoint
CREATE INDEX `store_batch_expiry_idx` ON `store_batch` (`expiry_date`);
--> statement-breakpoint
-- reconciliation guard: aborts the whole migration transaction on any mismatch
CREATE TABLE `_migration_inventory_recon` (`mismatches` integer NOT NULL CHECK (`mismatches` = 0));
--> statement-breakpoint
INSERT INTO `_migration_inventory_recon` (`mismatches`)
SELECT count(*) FROM `_migration_inventory_batch_expected` e
LEFT JOIN `store_batch` b ON b.`id` = e.`id`
WHERE b.`initial_quantity_grams` <> e.`initial_grams`
   OR b.`quantity_grams` <> e.`quantity_grams`;
--> statement-breakpoint
DROP TABLE `_migration_inventory_recon`;
DROP TABLE `_migration_inventory_batch_expected`;
```

Notes:

- The `typeof(...) = 'integer'` CHECKs matter because SQLite type affinity does not reject
  REALs in INTEGER columns. They are the enforcement half of the "precision" change.
- Cross-column `quantity_grams <= initial_quantity_grams` assumes historical data is not
  corrupt. Pre-check before shipping:
  ```sql
  SELECT count(*) FROM store_batch WHERE quantity_kg > initial_quantity_kg;
  SELECT count(*) FROM store_batch WHERE expiry_date <= harvest_date;
  SELECT count(*) FROM store_stock_conversion WHERE ROUND(raw_kgs_used * 1000) = 0 OR units_produced <= 0;
  ```
  Non-zero results block the migration by design (open decision 4: fail loudly, never clamp).
- The `CASE ... ELSE NULL` NOT NULL trick in `recordConversion` (`inventory.ts:269-270,282-283`)
  is replaced by plain subtraction; the new CHECKs abort invalid states with typed names.

**Service/UI updates required (all locations verified):**

| Location                                                                                 | Change                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `admin/inventory.ts:118,124,131-132,147,152-153`                                         | select `quantityGrams`/`initialQuantityGrams`; integer-share compare (`grams <= Math.round(initialGrams * BATCH_LOW_SHARE)` or `grams * 5 <= initialGrams` for the fixed 1/5); `stock` payload already grams; `stockLabel` formats kg via helper |
| `admin/inventory.ts:202-363` (`recordConversion`)                                        | input `rawGramsUsed`; subtract grams; movement quantity = `-rawGramsUsed` (no more `*1000` rounding); map CHECK failures to typed reasons                                                                                                        |
| `admin/inventory.ts:383-467` (`TransferItemInput`, `createTransfer`)                     | typed payload: `{ itemType:'batch', quantityGrams }` vs `{ itemType:'variant'                                                                                                                                                                    | 'material', quantityUnits }`; validation moves to the canonical rule |
| `admin/inventory.ts:544-642` (`completeTransfer`)                                        | delete the post-flip movement batch; rely on `trg_transfer_completed_ledger` (§3.5) so status + ledger are one transaction                                                                                                                       |
| `routes/admin/inventory/reports/+page.server.ts:14-38`                                   | `totalGrams = sum(quantity_grams)`; compute display kg in the component                                                                                                                                                                          |
| `routes/admin/inventory/reports/+page.svelte:37-42`                                      | render `totalGrams / 1000` (1 decimal); keep `admin-report-total-kg` test id or rename to `admin-report-total-grams` (tests + i18n key `admin.reports.totalKg`, `messages.ts:615,1346`)                                                          |
| `routes/admin/inventory/alerts/+page.svelte:64`                                          | `stockLabel` comes from the service as a formatted kg string; no unit math in the view                                                                                                                                                           |
| `routes/admin/inventory/transfers/+page.server.ts:40-63` + `+page.svelte:99-128,175-178` | unit-aware form: kg input for `batch` converted to grams at the action boundary; display unit from `item.unit`; new i18n keys `admin.transfers.unit.g`, `admin.transfers.unit.unit`                                                              |
| `lib/i18n/messages.ts`                                                                   | add unit/format keys (ar+en), keep key parity                                                                                                                                                                                                    |
| `admin/inventory.spec.ts:23-27`                                                          | new DDL; expectations at `:57-76`, `:112-118`, `:159-165` use grams                                                                                                                                                                              |
| `scripts/seed.ts`, `scripts/e2e-setup.mjs` fixtures                                      | no batch rows are seeded today; if fixtures are added, use grams                                                                                                                                                                                 |
| New `src/lib/units.ts` (client+server safe)                                              | `kgToGrams(value): number` (finite, ROUND-half-away), `gramsToKg`, `formatGrams(lang)`; single definition used by service, UI, seed, tests                                                                                                       |

Amounts: the UI still accepts kg for humans; DB/API/ledger store grams. Conversion happens at
the action boundary (zod-refined, `.finite()`, capped) — one place, tested.

### 3.4 (d) Movement unit normalization

**Options.**

|                  | Option A — unit column + base units (recommended)                                                                   | Option B — typed movement tables                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape            | `store_stock_movement.quantity_base_units INTEGER` + `unit TEXT CHECK ('g','unit')`; same for `store_transfer_item` | `store_stock_movement_variant`, `_batch`, `_material` each with typed columns                                                              |
| Migration cost   | One rebuild per table; backfill `unit = CASE item_type …`                                                           | 3 new tables, data migration, dual-write window, drop old table                                                                            |
| FK integrity     | item_id stays polymorphic (no FK); optional existence trigger                                                       | Real FKs per table                                                                                                                         |
| Query cost       | Ledger reports unchanged shape                                                                                      | UNION ALL across 3 tables for every ledger query                                                                                           |
| Service/UI churn | Typed payloads in `inventory.ts` only                                                                               | Every movement consumer + reports                                                                                                          |
| Verdict          | **Adopt.** Fixes the ambiguity with proportional cost.                                                              | Rejected: normal-form purity not worth 3× migration churn; transfer items stay polymorphic anyway, so B cannot eliminate the union either. |

**Canonical unit rule (enforced by CHECK):**

```
item_type = 'batch'                 ⇒ unit = 'g'
item_type IN ('variant','material') ⇒ unit = 'unit'
```

Existing rows need no numeric conversion: batch movements are already grams
(`inventory.ts:301`); variant/material movements are counts. The backfill is pure metadata:

```sql
-- inside the movement table rebuild (reason_code is the commerce-owned adjustment reason)
INSERT INTO `__new_store_stock_movement`
  (`id`,`type`,`item_type`,`item_id`,`warehouse_id`,`quantity_base_units`,`unit`,`reason_code`,`ref_id`,`notes`,`created_at`)
SELECT `id`,`type`,`item_type`,`item_id`,`warehouse_id`,`quantity`,
       CASE WHEN `item_type` = 'batch' THEN 'g' ELSE 'unit' END,
       NULL,
       `ref_id`,`notes`,`created_at`
FROM `store_stock_movement`;
```

Invariants to add on the rebuilt table (SQL in §3.5): `quantity_base_units <> 0`; the
canonical-unit CHECK; `type = 'transfer' ⇒ warehouse_id IS NOT NULL`; `item_type` closed
vocabulary; nullable `reason_code` required only for `type='adjustment'` (COM owns the service/UI
and value vocabulary via `applyStockAdjustment`, COM §3g-g5); optional `BEFORE INSERT` trigger that
the item id exists (rejects dangling ledger rows, since FKs are impossible).

**Transfer items.** Same treatment for symmetry: `quantity` → `quantity_base_units` +
`unit`, canonical rule. Today a batch transfer is an untyped integer (`transfers/+page.server.ts:46`),
which is meaningless against kg-real batch stock; the new typed payload fixes it. Historical
batch transfer rows (production: 0) are unreconcilable by construction — document as
`-- verify manually before relying on old transfer ledgers` in the migration PR.

**Known ledger gap (open decision 6).** Order reservations decrement variant stock in
`trg_order_item_reserve_stock` (`0016:24-39`) but write **no** movement row. The ledger is
therefore incomplete for sales. This spec does not add sales rows because B keeps
reserve-at-placement (`2026-09-13-order-lifecycle-payments-design.md` §3.2) but owns the
sale/release semantics and any future `type='sale'` rows; §6 provides a derived
reconciliation query meanwhile.

### 3.5 (e) Defense-in-depth constraints

All CHECKs are named `ck_<table>_<what>` so SQLite's `CHECK constraint failed: <name>`
message is stable for error mapping (§6). All new tables are rebuilt with
`PRAGMA defer_foreign_keys = true` at the top of the migration file.

**CHECK list (recommended full set):**

| Constraint                           | Table                      | Definition                                                                                  | Replaces                          |
| ------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------- |
| `ck_batch_expiry_after_harvest`      | `store_batch`              | `expiry_date > harvest_date`                                                                | nothing                           |
| `ck_batch_initial_non_negative`      | `store_batch`              | `initial_quantity_grams >= 0`                                                               | nothing                           |
| `ck_batch_quantity_non_negative`     | `store_batch`              | `quantity_grams >= 0`                                                                       | NULL-trick                        |
| `ck_batch_quantity_within_initial`   | `store_batch`              | `quantity_grams <= initial_quantity_grams`                                                  | nothing                           |
| `ck_batch_grams_integer`             | `store_batch`              | `typeof(...)='integer'` ×2                                                                  | REAL affinity                     |
| `ck_conversion_raw_positive`         | `store_stock_conversion`   | `raw_grams_used > 0 AND typeof(raw_grams_used)='integer'`                                   | service `:215-216`                |
| `ck_conversion_units_positive`       | `store_stock_conversion`   | `units_produced > 0`                                                                        | service `:217-218`                |
| `ck_movement_quantity_non_zero`      | `store_stock_movement`     | `quantity_base_units <> 0`                                                                  | nothing                           |
| `ck_movement_unit_canonical`         | `store_stock_movement`     | `(item_type='batch' AND unit='g') OR (item_type IN ('variant','material') AND unit='unit')` | convention only                   |
| `ck_movement_item_type`              | `store_stock_movement`     | `item_type IN ('variant','batch','material')`                                               | default-only                      |
| `ck_movement_transfer_warehouse`     | `store_stock_movement`     | `type <> 'transfer' OR warehouse_id IS NOT NULL`                                            | nothing                           |
| `ck_movement_adjustment_reason`      | `store_stock_movement`     | `type <> 'adjustment' OR reason_code IS NOT NULL`                                           | nothing (COM owns the service/UI) |
| `ck_transfer_distinct_warehouses`    | `store_transfer`           | `from_warehouse_id <> to_warehouse_id`                                                      | service `:418` + form `:48`       |
| `ck_transfer_status`                 | `store_transfer`           | `status IN ('pending','outbound','completed','cancelled')`                                  | parse fallback `:367-374`         |
| `ck_transfer_item_quantity_non_zero` | `store_transfer_item`      | `quantity_base_units <> 0`                                                                  | service `:422-423`                |
| `ck_transfer_item_unit_canonical`    | `store_transfer_item`      | same expression as movement                                                                 | nothing                           |
| `ck_packaging_stock_non_negative`    | `store_packaging_material` | `stock_quantity >= 0`                                                                       | NULL-trick `:282-283`             |
| `ck_packaging_reorder_non_negative`  | `store_packaging_material` | `reorder_point >= 0`                                                                        | nothing                           |
| `ck_packaging_cost_non_negative`     | `store_packaging_material` | `cost_per_unit >= 0`                                                                        | nothing                           |
| `ck_warehouse_type`                  | `store_warehouse`          | `type IN ('bulk','fulfillment')`                                                            | fallback coercion `:36-38,44`     |
| `ck_order_stock_version`             | `store_order`              | `stock_version IN ('atomic','legacy')`                                                      | nothing                           |

**Deliberate omissions.** No CHECK on `order.status` (`stats.spec.ts:291` stores `refunded`;
payments spec B owns vocabulary). No CHECK on `order.payment_status` (B). No CHECK on
`governorate` (shipping zones may expand with shipping v2, COM §3b; boundary zod already
enforces the enum). No CHECK on `movement.type` (future types; `item_type` carries the unit
invariant).

**Triggers:**

```sql
-- 1. Ledger rows must reference a live item (polymorphic item_id cannot be an FK).
CREATE TRIGGER `trg_movement_item_exists`
BEFORE INSERT ON `store_stock_movement`
WHEN (`NEW`.`item_type` = 'variant' AND NOT EXISTS (SELECT 1 FROM `store_product_variant` WHERE `id` = `NEW`.`item_id`))
  OR (`NEW`.`item_type` = 'batch'   AND NOT EXISTS (SELECT 1 FROM `store_batch`           WHERE `id` = `NEW`.`item_id`))
  OR (`NEW`.`item_type` = 'material' AND NOT EXISTS (SELECT 1 FROM `store_packaging_material` WHERE `id` = `NEW`.`item_id`))
BEGIN
  SELECT RAISE(ABORT, 'MOVEMENT_ITEM_MISSING');
END;
--> statement-breakpoint

-- 2. Transfer completion writes the ledger in the same transaction as the status flip.
--    Replaces the two-batch logic at inventory.ts:573-623; idempotent (WHEN guards the flip).
CREATE TRIGGER `trg_transfer_completed_ledger`
AFTER UPDATE OF `status` ON `store_transfer`
WHEN `NEW`.`status` = 'completed' AND `OLD`.`status` <> 'completed'
BEGIN
  INSERT INTO `store_stock_movement`
    (`id`,`type`,`item_type`,`item_id`,`warehouse_id`,`quantity_base_units`,`unit`,`ref_id`,`created_at`)
  SELECT lower(hex(randomblob(16))), 'transfer', `ti`.`item_type`, `ti`.`item_id`,
         `NEW`.`from_warehouse_id`, -`ti`.`quantity_base_units`, `ti`.`unit`, `NEW`.`id`, `NEW`.`completed_at`
  FROM `store_transfer_item` `ti` WHERE `ti`.`transfer_id` = `NEW`.`id`;

  INSERT INTO `store_stock_movement`
    (`id`,`type`,`item_type`,`item_id`,`warehouse_id`,`quantity_base_units`,`unit`,`ref_id`,`created_at`)
  SELECT lower(hex(randomblob(16))), 'transfer', `ti`.`item_type`, `ti`.`item_id`,
         `NEW`.`to_warehouse_id`, `ti`.`quantity_base_units`, `ti`.`unit`, `NEW`.`id`, `NEW`.`completed_at`
  FROM `store_transfer_item` `ti` WHERE `ti`.`transfer_id` = `NEW`.`id`;
END;
```

The service then performs only the guarded `UPDATE ... WHERE id = ? AND status = ?` (existing
`affectedRowCount` check, `inventory.ts:573-584`); a lost race leaves no partial ledger, and a
retry sees `OLD.status = 'completed'` and inserts nothing. `trg_order_item_reserve_stock` and
`trg_order_status_cancel_restock` (0016:24-69) are recreated verbatim by the order-status
rebuild (D1, `0021` or folded into `0019`) unless B's `0019_payments` already ran, in which case
B's versions are captured and recreated instead (§3.1).

**D1 / libsql compatibility notes (verified against installed tooling and Cloudflare docs):**

1. **SQLite cannot add CHECKs or change column types/defaults with `ALTER TABLE`.** The
   0016/0017 project pattern applies: create `__new_*`, copy with explicit column lists,
   `DROP TABLE`, `RENAME`, recreate indexes/triggers. This is also what `drizzle-kit
0.31.10` generates for SQLite diffs.
2. **Generated `PRAGMA foreign_keys=OFF/ON` must be replaced with
   `PRAGMA defer_foreign_keys = true;`** at the top of the file. `foreign_keys` is a no-op
   inside a transaction; D1 documents `defer_foreign_keys` for exactly this migration use
   case, and each migration file is one transactional batch (wrangler rolls back the failed
   migration). The local drizzle migrator also wraps pending migrations in `BEGIN … COMMIT`
   (`node_modules/drizzle-orm/sqlite-core/dialect.js:657`).
3. `ALTER TABLE ... RENAME COLUMN` and `DROP COLUMN` are supported by current D1/libsql and
   already used by the staged drop (`drizzle/staged/0017_drop_legacy_product_columns.sql`);
   the replay spec proves `DROP COLUMN` on libsql (`migration-replay.spec.ts:187-226`).
   Rebuilds are still preferred where a CHECK is added.
4. D1 permits `PRAGMA table_info`, `defer_foreign_keys`, `ignore_check_constraints`; it
   blocks some scalar functions (`sqlite_version()` returned "not authorized" via the D1
   API on 2026-09-13). Do not use such functions in migration SQL.
5. `--> statement-breakpoint` is a SQL comment; both drizzle-kit migrate and
   `wrangler d1 migrations apply` handle the files as-is today (0016/0017 are already live
   in production through this path).
6. NULL semantics: every CHECK uses three-valued logic carefully — all new columns are
   `NOT NULL`, so `x >= 0` cannot be bypassed by NULL.

**Rustless alternative considered and rejected:** enforcing everything in services only.
Rejected because direct SQL (dashboard console, seed exports, future scripts) bypasses
services, which is exactly how inventory tables stayed empty and unchecked.

### 3.6 (f) Shared status constants/types

`src/lib/admin-order-status.ts` is already the client/server-safe single source: it exports
`ORDER_STATUSES`, `OrderStatus`, `parseOrderStatus` (legacy `paid`→`placed`),
`allowedTransitions`, `STATUS_ORDER`, and label/badge maps; server modules import it
(`src/lib/server/admin/orders.ts:4-14`) and it is imported by `$lib/components/AdminOrderStatusBadge.svelte`,
account pages, and admin pages. The module already exists in the repo and keeps its name; it is the
shared vocabulary payments consumes through `ORDER_STATUS_META` (roadmap §3.2), so this spec never
introduces a second status module.

Changes:

```ts
// additions to src/lib/admin-order-status.ts
export const STOCK_VERSIONS = ["atomic", "legacy"] as const;
export type StockVersion = (typeof STOCK_VERSIONS)[number];

/** Stored statuses the admin/UI must tolerate: lifecycle values + legacy aliases.
 *  Pre-B: [...ORDER_STATUSES, "paid"]. B-first: also "placed". */
export const STORED_ORDER_STATUSES = [...ORDER_STATUSES, "paid"] as const;

/** One record per status; UI label keys and email copy derive from it. */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    customerLabelKey: MessageKey; // "orders.placed"
    adminLabelKey: MessageKey; // "admin.orders.placed"
    email: { ar: string; en: string };
  }
> = {/* … move email.ts:517-522 values here … */};
```

- Replace the hardcoded pair at `admin/orders.ts:85-87` with the shared vocabulary
  (`STORED_ORDER_STATUSES` or a helper `storedStatusFilter(status)`).
- Derive `email.ts:517-522` `STATUS_LABELS` from `ORDER_STATUS_META.email` instead of a
  third copy.
- `stats.ts` already initializes from `ORDER_STATUSES` (`:106`) — switch its import to
  `$lib/admin-order-status` directly instead of the `./orders` re-export (no behavior change).
- `STATUS_ORDER` is currently identical to `ORDER_STATUSES` (`admin-order-status.ts:3,24`);
  keep both for API stability but define one from the other.
- Optional future cleanup (not this spec): rename the module to `$lib/order-status.ts` — it
  is no longer admin-only. Renaming touches 6 importers; defer to avoid churn.
- The server-only `stockVersion` default (`schema.ts:112`) and the new CHECK stay in sync via
  `STOCK_VERSIONS` used in a replay-test assertion.
- **Sequencing with B (§2.3 item 5):** `ORDER_STATUS_META` is the single edit point B uses
  when it replaces the vocabulary: it updates `ORDER_STATUSES`/`TRANSITIONS`/`STATUS_ORDER`/
  the META record/label keys in this one file, and every consumer (admin, account, email,
  invoice, export, stats) follows. Pre-B the "stored legacy" set is `['paid']`; B-first it is
  `['placed','paid']`. Whichever spec lands first creates the record; the other only fills
  values, so the two changes never collide in a third module.

---

## 4. Migration & rollout

### 4.1 Ordered migration files

**Frozen allocation (read first).** Migration numbers are frozen by the program roadmap §3.1:
EM `0018_email_delivery.sql`, PAY `0019_payments.sql`, OPS `0020_email_verified_backfill.sql`,
this spec's D1 `0021_order_status_default.sql`, D2 `0022_inventory_integrity.sql`, D4
`0023_drop_legacy_product_columns.sql`, and the staged D3 `after_drain_status_backfill.sql`.
D1 is conditional: if PAY has not landed, ship `0021` with `'placed'`; if PAY is applied (or
lands first), D1's rebuild content folds into `0019` once and `0021` is never created. Confirm the
next free tag in `drizzle/meta/_journal.json` (currently ending at `0017_catalog_authority`)
before writing files; never renumber a file that has landed on `main`.

| Order | Logical ID | File (frozen allocation)                                                 | Journal                    | Content                                                                                                                                                                                                     | Applied by                                      |
| ----- | ---------- | ------------------------------------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1     | D1         | `drizzle/0021_order_status_default.sql` (or folded into `0019_payments`) | yes                        | `store_order` rebuild: safe default (payments not applied: `'placed'`; payments applied: `'pending_payment'`, constraints only), `ck_order_stock_version`, recreate **all captured `store_order` triggers** | CI `migrate-production` before deploy           |
| 2     | D2         | `drizzle/0022_inventory_integrity.sql`                                   | yes                        | batch/conversion grams + movement/transfer_item units (incl. nullable `reason_code`) + all inventory CHECKs + `trg_movement_item_exists` + `trg_transfer_completed_ledger`                                  | CI, same chain                                  |
| 3     | D3         | `drizzle/staged/after_drain_status_backfill.sql`                         | no                         | pre-payments only: idempotent `UPDATE paid→placed` (status only; never `stock_version`); superseded once PAY lands (PAY owns the `placed`→`paid` cleanup)                                                   | manual after drain evidence                     |
| 4     | D4         | `drizzle/0023_drop_legacy_product_columns.sql`                           | yes (authored after drain) | drop 2 bridge triggers + 3 legacy columns; promote existing staged SQL                                                                                                                                      | CI; ships with schema/exporter cleanup          |
| —     | D4-alt     | `drizzle/staged/0017_drop_legacy_product_columns.sql`                    | no                         | retained emergency manual copy of D4                                                                                                                                                                        | manual, only if the journal path is unavailable |

Dependencies: D2 depends on D1 only for shared `PRAGMA defer_foreign_keys` behavior (they may
run in one drizzle transaction locally); D4 must not exist before drain evidence; D3 and D4 are
independent of each other and both gate on the same evidence. D4 drops only the three legacy
product columns (`price`, `stock`, `image`); COM §3h's `sku` uniqueness, `published` enforcement,
`salePrice`, and variant weight are separate commerce work and neither gate nor depend on D4. D1's
trigger-capture step depends on whether B's `0019_payments` has been applied — capture
`sqlite_master` at implementation time, never assume.

### 4.2 Idempotency and atomicity

- **Journal migrations** are tracked (`d1_migrations` / `__drizzle_migrations`) and never
  re-run; each file is applied as one transactional batch, so a failure rolls back the whole
  file. Do not hide data conversion behind `IF` gymnastics; make the migration itself
  atomic and fail loudly.
- **Reconciliation guard tables** inside D2 use a `CHECK (mismatches = 0)` insert so a
  mismatch aborts and rolls back. Scratch tables (`_migration_inventory_*`) are dropped at the end
  of the file.
- **Staged scripts** must be re-runnable where SQLite allows: D3 is an idempotent `UPDATE`;
  D4 is one-shot (`DROP COLUMN` has no `IF EXISTS`) and the runbook pre-checks
  `PRAGMA table_info(store_product)` before running it.
- Drizzle's local migrator wraps _all pending_ migrations in one transaction
  (`dialect.js:657-671`); D1 applies one file per batch. Both provide rollback on error.

### 4.3 Old-instance overlap rules

| Migration                      | Old build impact during migrate→deploy window                                                                                                                                                                                                                                             | Verdict                                                                                                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 (0021; or folded into 0019) | None meaningful: old build inserts `status` explicitly (`'paid'`), never reads the DEFAULT. `ck_order_stock_version` accepts the `'legacy'` default. Triggers are recreated from the captured live definitions.                                                                           | Safe                                                                                                                                                                                                                                                          |
| D2 (0022)                      | Old admin inventory reads/updates `quantity_kg` / `raw_kgs_used` / `quantity` columns that no longer exist → inventory admin screens 500 until deploy. Production inventory tables are empty and no batch can be created (no create UI); storefront/order paths never touch these tables. | Accept with forward-only policy. If zero-downtime is later required, the fallback is the catalog-style bridge (keep deprecated REAL columns + sync triggers, staged drop after drain) — rejected here as disproportionate for an owner-only, empty subsystem. |
| D4 (0023)                      | None: ships only after the live build is proven not to reference the columns.                                                                                                                                                                                                             | Safe                                                                                                                                                                                                                                                          |
| D3 (after-drain backfill)      | None: old admin `parseOrderStatus` maps `paid`→`placed`; the backfill runs only after old instances are gone. Once PAY lands, D3 is superseded and never runs; PAY owns the `placed`→`paid` cleanup.                                                                                      | Safe                                                                                                                                                                                                                                                          |

Do **not** rewrite `stock_version` for legacy orders until every legacy order is terminal and
the legacy cancel path is retired (`docs/decisions.md:1370`); the reservation mechanisms
differ and a premature flip would double-adjust or skip stock.

### 4.4 Rollback / roll-forward

- **Disaster recovery:** the ops spec §3.7 owns the full backup/restore and
  pre-destructive-migration export procedure. This spec requires, before running D4 or any
  destructive staged script: `wrangler d1 export beeking --remote --output=<backup>.sql` plus
  a D1 Time Travel bookmark (`wrangler d1 time-travel info beeking`; 7 days Free / 30 days paid).
- **Routine policy: forward-only.** Once D1/D2/D4 are applied (whichever indices they hold), do
  not roll the Pages deployment back to a build that predates them (missing columns/defaults).
  Fix forward with a hotfix deploy; Time Travel is reserved for data disasters, not routine
  rollback.
- A failed migration rolls itself back and blocks the deploy (CI stops at
  `migrate-production`), leaving the old build live and consistent with the old schema.

### 4.5 Fixture and replay updates

- The 8 `DEFAULT 'placed'` order DDLs already match the pre-B schema; add
  `ck_order_stock_version` to each for parity. Keep `migration-replay.spec.ts:94` `'paid'`.
  B-first: B §5.2 has already rewritten these fixtures with its columns/triggers and
  `'pending_payment'` default; this spec only adds the stock-version assertion.
- Rewrite `admin/inventory.spec.ts:23-27` to the new DDL (grams + unit columns + CHECKs) and
  update movement expectations at `:57-76` (batch `-2000` becomes `-2000` grams with
  `unit: 'g'` — the number stays, the meaning becomes explicit).
- Extend `migration-replay.spec.ts`: a `seedPreOrderRebuildSchema` (existing pre-0016 fixture +
  `apply0016`, plus `0019_payments` if it has landed) and a `seedPreInventoryIntegritySchema`
  (adds 0014-shaped inventory tables with fractional rows); apply D1/D2 and assert schema +
  data (see §5). Use a helper that runs a file in an explicit
  `BEGIN … PRAGMA defer_foreign_keys=true … COMMIT`, replacing the autocommit loop at `:34-38`
  for parent-table rebuilds.
- CI already replays the full chain (`drizzle-kit migrate` in the test job) and E2E replays
  it into isolated D1 state (`scripts/e2e-setup.mjs:80-109`), so new migrations are exercised
  end to end automatically.
- Journal guards: `migration-replay.spec.ts:178-185` asserts the staged drop is not in the
  journal. When D4 is promoted, update the assertion (D4 in journal, staged file
  retained/annotated).

---

## 5. Testing strategy

| Layer              | Test                                                                                                                                                                                                                                                                                                                                     | Location / notes                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Unit (math)        | `kgToGrams`/`gramsToKg` round-half-away, `0.1+0.2` class inputs, `0.0005 kg → 1 g`, `1.0004 kg → 1000 g`, invalid/NaN/∞ rejected                                                                                                                                                                                                         | new `src/lib/units.spec.ts`                                                                    |
| Unit (schema)      | After applying D1/D2 to a fresh in-memory libsql DB: `PRAGMA table_info` shows no `_kg` columns; safe `status` default and `stock_version='legacy'`; CHECK names present; indexes/triggers recreated (all captured `store_order` triggers survive the rebuild)                                                                           | extend `migration-replay.spec.ts`; use `client.executeMultiple` like `inventory.spec.ts:21-32` |
| Unit (constraints) | Attempt each invalid write with raw SQL and assert `/CHECK constraint failed: ck_/` or RAISE tag: negative packaging, `units_produced=0`, `raw_grams_used=0`, batch `expiry<=harvest`, `quantity>initial`, transfer `from=to`, transfer item 0, movement wrong unit, movement zero, movement missing item, order `stock_version='bogus'` | new `src/lib/server/db/constraints.spec.ts`                                                    |
| Unit (conversion)  | Fixture rows with fractional kg (`0.1`, `0.25`, `1.0005`) + conversion rows; apply D2; assert per-row grams equal `ROUND(kg*1000)` and totals match pre-migration expectations; assert the recon guard aborts on a deliberately corrupted fixture (mutation test)                                                                        | `migration-replay.spec.ts`                                                                     |
| Unit (service)     | `recordConversion` in grams (atomicity, competing conversions, material spend, NOT-NULL/CHECK mapping); `completeTransfer` leaves either `completed+ledger` or unchanged (failure injected into the ledger insert now aborts the status flip because both happen in the trigger)                                                         | extend `admin/inventory.spec.ts`; update `balances()` at `:40-51`                              |
| Unit (status)      | Pre-B: `createOrder` writes `placed`; a direct insert omitting status yields `placed`; `parseOrderStatus('paid')==='placed'`. B-first: those assertions live in B's suite; this spec adds only that an omitted-status insert yields B's safe default and that stats tolerate `refunded`                                                  | extend `orders.spec.ts`, `admin/stats.spec.ts`                                                 |
| E2E                | Existing checkout journey still completes (`tests/checkout.e2e.ts`); admin order list renders the new order as Placed; `/admin/inventory/reports` and `/alerts` load with zero inventory rows; transfer create with same warehouse shows the validation message                                                                          | extend `tests/checkout.e2e.ts`, `tests/admin-operations.e2e.ts`                                |
| Quality gate       | `vp check`, `vp test --run`, `vp build` per repo convention                                                                                                                                                                                                                                                                              | `AGENTS.md` / `quality-gate` skill                                                             |

Test commands already exist: `vp test --run` for units, Playwright for e2e; no new runner.

---

## 6. Observability

**Error mapping (services).** Extend `src/lib/server/sqlite.ts` with a cause-chain walker
(pattern already in `inventory.ts:332-347`):

```ts
export function findSqliteMessage(error: unknown): string;
export function findConstraint(error: unknown): string | null; // "ck_…" from "CHECK constraint failed: ck_…"
export function findAbortTag(error: unknown): string | null; // "OUT_OF_STOCK", "MOVEMENT_ITEM_MISSING", …
```

Services map known names to typed reasons and log unknown ones once per occurrence at
`console.error` (Workers Observability picks these up):

| Signal                                                                        | Mapped to                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `OUT_OF_STOCK`                                                                | `orders.outOfStock` (existing, `orders.ts:47-49`)                                           |
| `MISSING_VARIANT_ID`, `INVALID_QUANTITY`, `INVALID_PRICE`, `STOCK_NEGATIVE`   | typed checkout failure; log with order number                                               |
| `ck_conversion_raw_positive`, `ck_conversion_units_positive`                  | `recordConversion` reason `invalid`                                                         |
| `ck_packaging_stock_non_negative`                                             | `notEnoughMaterial`                                                                         |
| `ck_batch_quantity_non_negative`, `ck_batch_quantity_within_initial`          | `notEnoughRaw`                                                                              |
| `ck_transfer_distinct_warehouses`, `ck_transfer_status`, `ck_transfer_item_*` | transfer form message keys                                                                  |
| `MOVEMENT_ITEM_MISSING`                                                       | `materialNotFound`/`batchNotFound`/`variantNotFound` by item type                           |
| anything unmatched                                                            | `console.error("[db] unmapped constraint rejection", { constraint, op })` and rethrow (500) |

**Reconciliation queries** (surface on `/admin/inventory/reports`; all read-only):

```sql
-- R1: batch balance vs movement ledger (grams). Any row is drift.
SELECT b.id, b.batch_number, b.quantity_grams,
       b.initial_quantity_grams + COALESCE((
         SELECT SUM(m.quantity_base_units) FROM store_stock_movement m
         WHERE m.item_type = 'batch' AND m.item_id = b.id AND m.unit = 'g'
       ), 0) AS ledger_grams
FROM store_batch b
WHERE b.quantity_grams <> b.initial_quantity_grams + COALESCE((
        SELECT SUM(m.quantity_base_units) FROM store_stock_movement m
        WHERE m.item_type = 'batch' AND m.item_id = b.id AND m.unit = 'g'), 0);
```

_(Run before D2 in kg-comparable form; after D2 in grams. Pre-existing ≤0.5 g/conversion
drift caused by `inventory.ts:301` may legitimately surface in local databases once; report,
do not auto-correct.)_

```sql
-- R2: variants with stock ≠ converted-in − sold (derived because sales write no ledger row)
-- After B lands, non-cancelled includes pending_payment; that is intended — reserved stock is
-- committed stock.
SELECT v.id, v.stock,
       COALESCE((SELECT SUM(oi.quantity) FROM store_order_item oi
                 JOIN store_order o ON o.id = oi.order_id
                 WHERE oi.variant_id = v.id AND o.status <> 'cancelled'), 0) AS sold_units
FROM store_product_variant v;

-- R3: dangling ledger item_ids (polymorphic, no FK)
SELECT m.id, m.item_type, m.item_id FROM store_stock_movement m
WHERE (m.item_type = 'batch'    AND NOT EXISTS (SELECT 1 FROM store_batch b WHERE b.id = m.item_id))
   OR (m.item_type = 'variant'  AND NOT EXISTS (SELECT 1 FROM store_product_variant v WHERE v.id = m.item_id))
   OR (m.item_type = 'material' AND NOT EXISTS (SELECT 1 FROM store_packaging_material p WHERE p.id = m.item_id));
```

Alerting guidance: R1/R3 non-empty ⇒ review before any inventory correction; R2 differences
are expected for legacy orders (pre-0016 reservations have no `variant_id`) and for
conversion-to-variant flows — compare only per-variant, never site-wide. No new monitoring
stack: the reports page plus Workers Observability logs match the project's free-tier
posture (`docs/architecture.md:251-261`).

---

## 7. Security

- **No new attack surface.** All new constraints are server-side; inventory/admin routes keep
  `isAdminRole` guards (`transfers/+page.server.ts:53`), checkout keeps nonce proof cookies.
- **Integer bounds.** D1 stores 64-bit INTEGERs; JS numbers are safe to 2^53−1. Grams make
  overflow unreachable for real honey (≈9×10^12 kg). Add explicit boundary caps anyway:
  `z.coerce.number().int().positive().max(1_000_000_000)` on transfer quantities
  (`transfers/+page.server.ts:46`) and the conversion form; a `MAX_CART_QUANTITY` cap in
  `sanitizeCartLines` (`cart-cookie.ts:21-24` currently floors but does not cap; the order
  path bounds by stock, so this is belt-and-braces).
- **Boundary validation is the first line; CHECKs are the backstop** — never the only
  enforcement for user input.
- **Polymorphic `item_id`** in movements cannot be FK-constrained; the existence trigger plus
  R3 reconciliation cover it. This is an accepted, documented residual.
- No secrets, auth, PII, or dependency changes in this spec.

---

## 8. Open decisions

1. **Grams vs milligrams** → **grams.** Matches `weightGrams` (`schema.ts:52`), existing ×1000
   conversions (`inventory.ts:131,301`), and retail sizes. Milligrams add no needed precision
   and invite scale bugs.
2. **Movement table design** → **unit column + base units (Option A).** Typed tables (Option
   B) cannot remove polymorphism in `transfer_item`, triple migration/query churn, and buy
   little. Revisit only if reporting needs per-type columns.
3. **Drop timing vs launch** → **decoupled.** Keep the product-column drop staged/gated on
   drain evidence; never bundle it with COM feature work or a marketing freeze. Wait ≥24 h of
   revision-clean evidence (health SHA + checksum canary) after the drain build is live, then
   ship D4 (`0023`) in the next release. The expansion already shipped, and the remaining catalog
   fields (`sku` uniqueness, `published` enforcement, `salePrice`, variant weight) are COM §3h and
   do not depend on these columns.
4. **Constraint strictness (fail vs clamp)** → **fail loudly.** Services pre-check and return
   typed reasons; CHECKs abort direct-SQL violations; the migration pre-checks block on
   existing corrupt rows (prod has none). Never silently clamp or coerce.
5. **Fold the status default into the payments migration?** → **Conditional, per the roadmap
   (D19).** If payments is not applied, D1 ships standalone as `0021_order_status_default.sql`
   with `'placed'`. If B's `0019_payments` is applied (or lands first), D1's rebuild content is
   folded into `0019` once, uses `pending_payment` as the default, and completes constraints only
   (`ck_order_stock_version` + trigger capture/recreate); `0021` is never created. What must not
   happen is two `store_order` rebuilds in one release window, or a `'paid'` physical default
   surviving indefinitely.
6. **Sales rows in the movement ledger** → **defer to payments spec B.** Stock decrement at
   order vs payment is explicitly reopened there (`docs/todo.md:99-109`); writing `sale`
   movements now would encode semantics B may change. R2 derives the check meanwhile.
7. **Rename `admin-order-status.ts` → `order-status.ts`** → **defer.** It is no longer
   admin-only, but the rename touches 6 importers and carries zero functional value; note it
   as cleanup when B touches status code.

---

## 9. Ordered task breakdown

Estimates are focused working time; dependencies are hard gates.

| #   | Task                                                                                                                                                                                                                                                              | Est.  | Depends on          | Verification                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ADR entry in `docs/decisions.md` for this pass + pre-flight checklist (production row counts re-checked; B/ops/email spec boundaries acknowledged; roadmap-frozen journal allocation confirmed)                                                                   | 0.5 d | —                   | ADR merged before D1                                                                                                                      |
| 2   | `src/lib/units.ts` + `units.spec.ts` (grams/kg conversion, formatting, caps)                                                                                                                                                                                      | 0.5 d | —                   | `vp test --run`                                                                                                                           |
| 3   | D1 (0021; or the `0019` fold): capture live `store_order` triggers, edit `schema.ts` default + `check()`, `drizzle-kit generate --name order_status_default`, hand-edit SQL (defer pragma, explicit column lists, verbatim trigger recreate), sync 8 fixture DDLs | 1 d   | 1                   | replay test inserts an order omitting status → safe default; cancel-restock (and B's triggers, if present) still defined; `vp test --run` |
| 4   | Order error mapping + shared `stock_version` vocabulary (part of §3.6)                                                                                                                                                                                            | 0.5 d | 3                   | `orders.spec.ts` mapping cases; grep shows no hardcoded `["placed","paid"]`                                                               |
| 5   | D2 (0022): inventory schema + `check()` declarations; `drizzle-kit generate --name inventory_integrity`; hand-edit conversion/backfill/recon-guard/triggers                                                                                                       | 1.5 d | 2                   | replay fixture with fractional kg; mutation test proves recon guard aborts                                                                |
| 6   | Inventory service updates: grams (`inventory.ts` all sites), typed transfer payloads, `completeTransfer` single-transaction via trigger, error mapping                                                                                                            | 1.5 d | 5                   | `admin/inventory.spec.ts` updated, competing conversions still atomic, completion failure leaves status unchanged                         |
| 7   | Admin inventory UI/i18n/test-id updates (reports, alerts, transfers)                                                                                                                                                                                              | 1 d   | 6                   | component/unit tests + manual page check; ar/en key parity                                                                                |
| 8   | Seed/tooling: exporter SELECT/INSERT cleanup prepared, `inventory.spec.ts` DDL, no batch seed rows                                                                                                                                                                | 0.5 d | 5                   | `export-d1-seed.ts` runs on the new schema; e2e setup green                                                                               |
| 9   | Constraint test suite `src/lib/server/db/constraints.spec.ts` (every CHECK/trigger failure path)                                                                                                                                                                  | 1 d   | 5                   | `vp test --run`                                                                                                                           |
| 10  | Observability: constraint mapping helper, reports reconciliation queries R1–R3, log conventions (ops spec §3.8 owns log enablement)                                                                                                                               | 1 d   | 6, 9                | query results on seeded fixtures; unmapped-error log test                                                                                 |
| 11  | E2E additions (checkout → safe status; inventory pages smoke; transfer validation)                                                                                                                                                                                | 0.5 d | 6, 7                | `playwright test`                                                                                                                         |
| 12  | Drain evidence runbook + production runbook section (health-SHA revision check, canary checksum, export/bookmark)                                                                                                                                                 | 0.5 d | 1                   | operations can execute steps verbatim                                                                                                     |
| 13  | Catalog drop: after evidence, generate D4 + schema/exporter/d1-seed cleanup + grep gate + post-drop smoke                                                                                                                                                         | 1 d   | 12 + drain evidence | §3.2 step-4 queries; storefront + admin image upload smoke                                                                                |
| 14  | After-drain status backfill script + run (pre-payments only; once PAY lands verify PAY's `placed`→`paid` cleanup instead)                                                                                                                                         | 0.5 d | 12 + drain evidence | `SELECT count(*) FROM store_order WHERE status='paid'` → 0; `stock_version` untouched                                                     |
| 15  | Docs close-out: `docs/architecture.md` (grams/units/authority), `docs/todo.md` statuses (including the stale entry at `:341-350`), ADR append, cross-spec index/numbering notes                                                                                   | 0.5 d | 3–14                | docs reviewed in PR                                                                                                                       |

Critical path: 1 → 3 → 5 → 6 → 7 → 11 → 15 (≈6 working days). Items 12–14 are gated on real
drain evidence (a wall-clock gate, not effort) and may run in parallel with 8–11. If B is
implemented first, tasks 3/4 change shape as described in §2.3/§3.1 and shrink to a
trigger-capture + CHECK alignment task (≈0.5 d).

---

## Appendix A — ADR draft (append to `docs/decisions.md` when the first of these migrations merges)

**Context.** The order `status` column defaulted to `'paid'` while runtime writes `'placed'`;
inventory mass was stored as REAL kg while its ledger was written in grams; several invariants
existed only in service code; the catalog legacy columns were bridged but not dropped. Three
sibling specs dated 2026-09-13 (payments, ops/security, email) share this schema surface; the
payments spec replaces the status vocabulary on its own timeline.

**Decision.** (1) Rebuild `store_order` with a safe default — `'placed'` as `0021` while payments
is unmerged, `'pending_payment'` when D1's content is folded into PAY's `0019` — plus a
`stock_version IN ('atomic','legacy')` CHECK; capture and recreate every trigger attached to
`store_order` rather than assuming 0016's definition, and never ship two rebuilds in one release
window. Gate the D3 `paid`→`placed` backfill on drain and keep it pre-payments-only; leave
`stock_version` untouched. (2) Convert batch/conversion mass to INTEGER grams
with a `ROUND(kg*1000)` data conversion, a mismatch-aborting recon guard, and a single shared
conversion helper. (3) Normalize ledger/transfer units via `quantity_base_units` + `unit`
with canonical-unit CHECKs; write transfer ledger rows from an `AFTER UPDATE` trigger so
status and ledger commit atomically. (4) Add named CHECKs for batch, packaging, conversion,
transfer, and warehouse invariants; make admin API failures typed and logged. (5) Promote the
legacy product-column drop into the journal after drain evidence instead of applying the
staged file ad hoc, so all environments converge and seed tooling keeps working. (6) Keep the
payments state machine out of scope; payments spec B owns status vocabulary and sale-side
ledger semantics; migration indices are frozen by the program roadmap (`0018`–`0023` plus the
staged D3 file).

**Consequences.** Direct SQL can no longer create impossible inventory states; order states
cannot silently default to paid; mass arithmetic is exact at 1 g; old admin inventory
instances break during the inventory-integrity migrate→deploy window (accepted: owner-only,
empty subsystem, forward-only policy); the payments spec inherits a safe default and a ledger
ready for `sale` rows without further schema change. The main coordination hazard is
trigger loss when rebuilding `store_order` after the payments migration — mitigated by the
capture-and-recreate rule.

## Appendix B — Evidence log (read-only verification performed for this spec)

- Static inspection of `schema.ts`, `orders.ts`, `admin/inventory.ts`, `admin/orders.ts`,
  `admin-order-status.ts`, `email.ts`, `stats.ts`, migrations 0000/0014/0016/0017 and the
  staged drop, all spec DDL files, `scripts/seed.ts`, `scripts/export-d1-seed.ts`,
  `d1-seed.sql`, CI workflow, `drizzle.config.ts`, and the local migrator source.
- Production D1 (read-only): migration level `0017_catalog_authority`; row counts
  `store_order=0`, all inventory tables `=0`, `store_product` legacy `image<>''` = 191,
  `store_product_image=561`; `sqlite_version()` is not authorized by the D1 API.
- Cloudflare docs: D1 migrations (`defer_foreign_keys` guidance), SQL statements/PRAGMAs,
  Time Travel (7 days Free / 30 days paid, always on).
- Toolchain: `drizzle-orm 0.45.2` (`check()` available), `drizzle-kit 0.31.10`
  (`generate --name`, emits `PRAGMA foreign_keys=OFF/ON` in recreates),
  `drizzle-orm/sqlite-core/dialect.js:657` (local migrator wraps pending migrations in one
  transaction), wrangler applies each D1 migration file as one batch and rolls back on error.
- **Could not verify:** Workers Observability key availability for per-deployment script
  version (API returned unavailable / empty) — superseded by the ops spec's `/api/health`
  version approach, which is now the primary drain signal; the `.finite()` admin page-param
  todo item is already implemented (orders/products/customers loaders), so it is not part of
  this work.
- **Cross-spec reconciliation performed after drafting:** read the three sibling specs in
  `docs/superpowers/specs/`; incorporated their decisions into §2.3 (payments vocabulary,
  `0019_payments` allocation, trigger recreate in B §4.1), §3.2 (ops `/api/health` revision
  check, ops backup section), §3.6 (B's status-consumer list), §4.1 (roadmap-frozen allocation),
  §4.4 (backup ownership), and §9 (B-first task shape). The migration sketches in §3.1 and §3.3
  remain valid; only their contents are conditional on whether `0019_payments` has landed
  (D1 fold).
