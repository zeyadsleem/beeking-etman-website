# مملكة النحل — Kingdom of Honey

Arabic-first RTL storefront for Etman natural honey: catalog with variants,
custom blend studio (`/blends`), signed-cookie cart, guest checkout with mock
payment (no card data collected), optional accounts, and full ar/en i18n.

## Stack

- SvelteKit 2 (Svelte 5, runes), TypeScript strict
- Tailwind CSS v4 (Cairo variable font, RTL); UI primitives via `bits-ui` v2
- Drizzle ORM + SQLite — lazy driver: Cloudflare **D1** in production,
  libsql (`file:local.db`) for local dev/tests
- Better Auth (password provider) for optional accounts
- Vitest (unit) + Playwright (e2e)
- Toolchain: Vite+ (`vp`); package manager: pnpm

## Setup

```sh
pnpm install
cp .env.example .env            # local libsql config for drizzle-kit/tests
cp .dev.vars.example .dev.vars  # secrets for `wrangler pages dev` / e2e
pnpm db:reset                   # drizzle migrations + seed local.db
pnpm dev                        # start the dev server
```

For a hydrated app (cart/checkout), use the production preview:

```sh
pnpm run build && pnpm run preview   # wrangler pages dev on :4173
```

## Database scripts

| Command           | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `pnpm db:reset`   | Migrate + seed `local.db` via drizzle-kit        |
| `pnpm db:studio`  | Browse `local.db` in Drizzle Studio              |
| `pnpm db:seed:d1` | Export `local.db` catalog to `d1-seed.sql`       |
| `pnpm d1:migrate` | Apply migrations to local D1 (`.wrangler/state`) |
| `pnpm d1:seed`    | Apply `d1-seed.sql` to local D1                  |
| `pnpm d1:reset`   | Full local D1 reset (migrate + seed both layers) |

Remote D1: `pnpm wrangler d1 migrations apply beeking --remote`, then
`pnpm wrangler d1 execute beeking --remote --file=d1-seed.sql`.

## Testing

```sh
pnpm test:unit -- --run   # Vitest unit tests
pnpm test:e2e             # Playwright against the seeded preview server
pnpm test                 # both suites
pnpm check                # svelte-check
```

## Deployment

Cloudflare Pages (Free tier) with `adapter-cloudflare`; GitHub Actions runs
check + unit + build + e2e, then deploys to Pages on merge to `main`
(`.github/workflows/ci.yml`). Production requires `BETTER_AUTH_SECRET`,
`ORDER_ACCESS_SECRET`, and `ORIGIN` as Pages environment variables
(validated at boot by `src/lib/server/env.ts`). Cost posture and monitoring:
`docs/architecture.md`.

## Notes

- `vp dev` serves HTML without client hydration scripts in this environment,
  so client-side JS (cart, checkout) does not work under `dev`. Use the
  production preview for anything interactive — the e2e suite already does.
- Scripts must be run with pnpm: `package.json` pins
  `devEngines.packageManager` to pnpm and npm refuses to run them.
- Deeper docs live in `docs/architecture.md` (system design), `docs/decisions.md`
  (ADR log), and `docs/todo.md` (work status).
