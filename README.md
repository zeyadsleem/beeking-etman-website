# بيت العسل — Honey Storefront

Arabic RTL storefront for natural honey: catalog, cart, guest checkout with mock
payment, and optional accounts.

## Stack

- SvelteKit (Svelte 5, runes), TypeScript strict
- Tailwind CSS v4 (Cairo variable font, RTL)
- Drizzle ORM + SQLite (libsql, `local.db`)
- Better Auth (password provider) for optional accounts
- Vitest (unit) + Playwright (e2e)
- Toolchain: Vite+ (`vp`); package manager: pnpm

## Setup

```sh
pnpm install
pnpm db:reset   # run Drizzle migrations, then seed the catalog
pnpm dev        # start the dev server
```

## Testing

```sh
pnpm test:unit -- --run   # Vitest unit tests
pnpm test:e2e             # seed + build + Playwright against the preview server
pnpm test                 # both suites
```

## Notes

- `pnpm dev` serves the app, but in this environment the Vite+ dev server does
  not serve client hydration scripts, so client-side JS (cart, checkout) does
  not work under `dev`. Use the production preview
  (`pnpm run build && pnpm run preview`) for anything that needs a hydrated app
  — the e2e suite already does this.
- Scripts must be run with pnpm: `package.json` pins
  `devEngines.packageManager` to pnpm and npm refuses to run them.
