# Customer Account Area — Design

Date: 2026-08-22
Status: Approved design (user confirmed full scope, address picker variant B)

## Goal

Give registered customers a complete account area and stop treating every
order as a one-off guest transaction: editable profile, saved addresses that
prefill checkout, and a full order history with a detail page.

Roadmap context: this is item 1 of 4 in `docs/todo.md` → "Roadmap (2026-08-22)".

## Scope

In:

- Profile page: display name (editable), email (read-only), password change,
  sign-out entry point.
- Saved addresses: CRUD for up to 10 addresses per user, one default.
- Order history detail page under `/account/orders/[id]`.
- Checkout integration: saved-address picker + optional "save this address".

Out (deferred on purpose):

- Email change — requires verified-email flow; lands with roadmap item 3
  (transactional email). Email is displayed read-only until then.
- Payment changes — mock payment stays; real gateway is roadmap item 4.
- Admin dashboard, notifications — separate sub-projects.

## Data model (migration 0007)

New table `store_address`, following existing conventions
(`crypto.randomUUID()` ids, integer epoch timestamps, snake_case columns):

```ts
export const address = sqliteTable(
  "store_address",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(), // no FK constraint (see note below)
    label: text("label").notNull(), // "البيت", "الشغل"
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    isDefault: integer("is_default").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("store_address_userId_idx").on(table.userId)],
);
```

The `user_id` foreign key is deliberately dropped from the spec above as shipped
(plain column + index): it mirrors the existing `store_order` convention, avoids
relying on D1's FK enforcement, and keeps the account-deletion lifecycle
explicit in the service layer.

Rules enforced in the service layer:

- Max 10 addresses per user; creating an 11th fails with a typed error.
- First address becomes default automatically (`isDefault = 1`).
- Exactly one default per user: setting a new default clears the old one in
  the same batch; deleting the default promotes the most recent remaining
  address.

## Server layer

New module `src/lib/server/addresses.ts` — the only place that touches the
address table:

- `listAddresses(userId)`, `getDefaultAddress(userId)`,
  `createAddress(userId, input)`, `updateAddress(userId, id, input)`,
  `setDefaultAddress(userId, id)`, `deleteAddress(userId, id)`.
- Input validated with zod at every entry point: label ≤ 40 chars,
  name ≤ 80, phone EGP-friendly pattern (≤ 20 chars), address ≤ 200,
  city ≤ 60. All ownership checks filter by `userId` in the WHERE clause
  (no read-modify-write races on other users' rows).
- Typed result union `{ ok: true, ... } | { ok: false, error }`; no thrown
  control flow, no swallowed errors.

Checkout hook: after a successful order commit, if the buyer is
authenticated AND checked "save this address", call `createAddress` with the
submitted form values. The checkbox appears only when the picker is on
"عنوان جديد"; picking a saved address and editing its fields never rewrites
the stored copy (the order keeps the submitted values). Failure to save an
address must NOT fail the order — log and continue.

Password change uses better-auth's built-in `changePassword` (requires
current password); no custom auth endpoints. Phone validation reuses the
exact rule already enforced by the checkout form.

## Routes and UI

```
/account              profile hub
/account/addresses    list + create/edit/delete dialogs
/account/orders       existing paginated list (+ link to detail)
/account/orders/[id]  order detail
```

- `/account` — shows name/email, inline edit-name form, password-change form,
  link out to addresses and orders. Uses better-auth client actions.
- `/account/addresses` — cards list; add/edit via bits-ui Dialog matching the
  CartDrawer pattern; delete asks for confirmation; default badge + action.
- `/account/orders/[id]` — items, quantities, unit prices, total, status,
  shipping snapshot, order number/date. Reuses success-page presentation.
- All four routes guard via server load: no session → `redirect(302, /login)`
  with `redirectTo` back to the requested page.
- Design system: existing مملكة النحل tokens/components, RTL, bits-ui;
  view-transition friendly navigation between account pages.

## Checkout integration (variant B)

On `/checkout` for authenticated users with ≥ 1 saved address:

- RadioGroup above the shipping form listing saved addresses
  ("label — name, city, phone") + an explicit "عنوان جديد" option.
- Selecting an address fills the form fields; the form remains the single
  source of truth — values stay editable before submit.
- Optional checkbox "احفظ هذا العنوان" appears only for authenticated users
  when the picker shows "new address".
- Guests see today's plain form unchanged.

## Security

- IDOR: order detail verifies `order.userId === session.user.id`, else 404
  (uniform response), mirroring the HMAC gate pattern from the 2026-08-21
  hardening pass.
- Every address mutation is scoped by `userId` in SQL, never by id alone.
- zod validation on all inputs (server side is authoritative).
- Rate limit address mutations with the existing `store_rate_limit`
  mechanism (same style as cart/search endpoints).
- No secrets or PII in logs.

## Testing

- Unit (vitest): addresses service — validation edges, 10-cap, first-default,
  default swap, delete-promotes-next, ownership scoping.
- Integration/e2e (Playwright): register → add address → set second default →
  logout → login → checkout prefilled from default → switch address in picker
  → complete order with "save" unchecked → order appears in history → open
  detail page. Plus negative e2e: logged-out access redirects to login.
- Existing suites keep passing; quality gate before merge.

## Rollout

Feature branches off `main` through the existing CI workflow
(test → e2e → deploy). Migration 0007 applies via the deploy job's
`d1 migrations apply beeking --remote` step. No feature flags needed: new
routes are additive and checkout changes are gated on having saved addresses.
