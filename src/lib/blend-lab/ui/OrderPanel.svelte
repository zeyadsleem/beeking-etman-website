<script lang="ts">
  import {
    ADDITIVE_KEYS,
    MAX_ORDER_QTY,
    jarLabel,
    type AdditiveKey,
    type BaseHoneyOption,
    type JarSize,
  } from "$lib/blends";
  import type { BlendCartItem } from "$lib/cart";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { blendUnitPrice } from "$lib/blend-lab/pricing";
  import { addBlend, openDrawer } from "$lib/cart-store.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import { formatEGP } from "$lib/currency";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { CatalogEntry } from "./catalog";

  let {
    lang,
    baseHoneys,
    additives,
    blendImage,
  }: {
    lang: Lang;
    baseHoneys: Map<BaseHoneyOption["id"], Record<JarSize, CatalogEntry>>;
    additives: Map<AdditiveKey, CatalogEntry & { key: AdditiveKey; label: string }>;
    blendImage: string;
  } = $props();

  const game = getBlendsGame();

  const base = $derived(
    game.honeyId ? baseHoneys.get(game.honeyId)?.[game.jarSize] : undefined,
  );

  const selectedAdditives = $derived(
    ADDITIVE_KEYS.flatMap((key) => {
      const entry = additives.get(key);
      const qty = game.doses[key];
      return entry && qty > 0 ? [{ entry, qty }] : [];
    }),
  );

  const unitPrice = $derived(
    blendUnitPrice([...baseHoneys], [...additives], game.honeyId, game.jarSize, game.doses),
  );

  // stock of the composite line = min(base stock, each chosen additive stock floor)
  const maxQty = $derived(
    Math.min(
      MAX_ORDER_QTY,
      base?.stock ?? 1,
      ...selectedAdditives.map((a) => Math.floor(a.entry.stock / Math.max(1, a.qty))),
    ),
  );

  function orderBlend(): void {
    if (!base || maxQty < 1) return;
    // A single adjustable blend line carries the jar count on `quantity`.
    const line: Omit<BlendCartItem, "kind" | "id"> = {
      baseVariantId: base.variantId,
      productId: base.productId,
      name: base.name,
      variantName: jarLabel(lang, game.jarSize),
      image: blendImage,
      jarSize: game.jarSize,
      basePrice: base.price,
      stock: base.stock,
      quantity: game.quantity,
      additives: selectedAdditives.map((a) => ({
        key: a.entry.key,
        variantId: a.entry.variantId,
        productId: a.entry.productId,
        name: a.entry.label,
        image: a.entry.image,
        qty: a.qty,
        price: a.entry.price,
        stock: a.entry.stock,
      })),
    };
    addBlend(line);
    openDrawer();
  }
</script>

<section
  class="pointer-events-auto rounded-3xl bg-parchment/95 p-5 shadow-2xl ring-1 ring-cocoa-900/10 backdrop-blur"
  data-testid="blends-order-panel"
>
  <h2 class="headline text-xl font-bold text-cocoa-900">{t(lang, "blends.game.order.title")}</h2>

  <ul class="mt-2 space-y-1 text-sm text-cocoa-800">
    {#if base}
      <li class="font-semibold">{base.name} · {jarLabel(lang, game.jarSize)} — {formatEGP(base.price, lang)}</li>
    {/if}
    {#each selectedAdditives as a (a.entry.key)}
      <li class="ps-4">+ {a.entry.label} ×{a.qty} — {formatEGP(a.entry.price * a.qty, lang)}</li>
    {/each}
  </ul>

  <div class="mt-3 flex items-center justify-between gap-3">
    <span class="text-sm font-semibold text-cocoa-800">{t(lang, "blends.game.order.quantity")}</span>
    <QuantityPicker
      {lang}
      value={game.quantity}
      max={maxQty}
      onChange={(q) => game.setQuantity(q, maxQty)}
    />
  </div>

  <p class="mt-1 text-xs text-cocoa-600">{t(lang, "blends.game.order.unitPrice")}: {formatEGP(unitPrice, lang)}</p>
  <p class="mt-0.5 text-base font-bold text-honey-700" data-testid="order-total">
    {t(lang, "blends.game.order.total")}: {formatEGP(unitPrice * game.quantity, lang)}
  </p>

  <button
    class="btn-primary mt-3 w-full disabled:opacity-50"
    disabled={!base || maxQty < 1}
    onclick={orderBlend}
    data-testid="add-to-cart-btn"
  >
    {maxQty < 1 ? t(lang, "blends.game.order.outOfStock") : t(lang, "blends.game.order.addToCart")}
  </button>

  <button class="btn-outline mt-2 w-full" onclick={() => game.reset()}>
    {t(lang, "blends.game.restart")}
  </button>
</section>
