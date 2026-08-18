<script lang="ts">
  import { enhance } from "$app/forms";
  import { clearCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import { isBlendItem, itemId, lineTotal } from "$lib/cart";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  let submitting = $state(false);

  function value(name: string) {
    return form?.values ? String(form.values[name] ?? "") : "";
  }
  function error(name: string) {
    return form?.errors?.[name] ?? "";
  }
</script>

<svelte:head><title>{t(lang, "checkout.pageTitle")}</title></svelte:head>

<div class="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
  <form
    method="post"
    action="?/submit"
    use:enhance={() => {
      submitting = true;
      return async ({ result, update }) => {
        if (result.type === "redirect") clearCart();
        submitting = false;
        update();
      };
    }}
    class="space-y-5 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm sm:p-8"
  >
    <input type="hidden" name="nonce" value={data.nonce} />

    <SectionTitle as="h1" className="text-4xl">{t(lang, "checkout.shippingTitle")}</SectionTitle>

    {#if error("cart")}
      <p class="rounded-xl bg-clay-50 px-4 py-3 text-sm font-semibold text-clay-700" role="alert" data-testid="cart-error">{error("cart")}</p>
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="field-label">
        {t(lang, "checkout.name")}
        <input name="name" value={value("name")} autocomplete="name" class="field mt-1" />
        {#if error("name")}<span class="field-error">{error("name")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.email")}
        <input name="email" type="email" value={value("email")} autocomplete="email" class="field mt-1" />
        {#if error("email")}<span class="field-error">{error("email")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.phone")}
        <input name="phone" inputmode="tel" value={value("phone")} autocomplete="tel" class="field mt-1" />
        {#if error("phone")}<span class="field-error">{error("phone")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.city")}
        <input name="city" value={value("city")} class="field mt-1" />
        {#if error("city")}<span class="field-error">{error("city")}</span>{/if}
      </label>
    </div>
    <label class="field-label">
      {t(lang, "checkout.address")}
      <input name="address" value={value("address")} autocomplete="street-address" class="field mt-1" />
      {#if error("address")}<span class="field-error">{error("address")}</span>{/if}
    </label>

    <fieldset class="rounded-2xl border border-cocoa-200 bg-cocoa-50/50 p-5">
      <legend class="px-2 text-sm font-bold text-cocoa-800">{t(lang, "checkout.paymentTitle")}</legend>
      <p class="mb-4 text-xs text-cocoa-500">{t(lang, "checkout.paymentNote")}</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="field-label sm:col-span-2">
          {t(lang, "checkout.cardNumber")}
          <input name="cardNumber" inputmode="numeric" placeholder="4242 4242 4242 4242" value={value("cardNumber")} autocomplete="cc-number" class="field mt-1 bg-white" />
          {#if error("cardNumber")}<span class="field-error">{error("cardNumber")}</span>{/if}
        </label>
        <label class="field-label">
          {t(lang, "checkout.cardExpiry")}
          <input name="cardExpiry" placeholder="08/28" value={value("cardExpiry")} autocomplete="cc-exp" class="field mt-1 bg-white" />
          {#if error("cardExpiry")}<span class="field-error">{error("cardExpiry")}</span>{/if}
        </label>
        <label class="field-label">
          {t(lang, "checkout.cardCvc")}
          <input name="cardCvc" inputmode="numeric" value={value("cardCvc")} autocomplete="cc-csc" class="field mt-1 bg-white" />
          {#if error("cardCvc")}<span class="field-error">{error("cardCvc")}</span>{/if}
        </label>
      </div>
    </fieldset>

    <Button
      variant="primary"
      type="submit"
      disabled={submitting}
      aria-busy={submitting}
      class="w-full"
    >{submitting ? t(lang, "checkout.submitting") : t(lang, "checkout.submit")}</Button>
  </form>

  <aside class="h-fit rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
    <h2 class="headline text-xl text-cocoa-900">{t(lang, "cart.summary")}</h2>
    <ul class="mt-4 space-y-3">
      {#each data.items as item (itemId(item))}
        <li class="flex flex-col gap-1 text-sm text-cocoa-700">
          {#if isBlendItem(item)}
            <div class="flex justify-between gap-2">
              <span class="line-clamp-1">
                {item.name} ({item.variantName}) × 1
              </span>
              <span class="font-semibold">{formatEGP(lineTotal(item), lang)}</span>
            </div>
            {#if item.additives.length > 0}
              <ul class="flex flex-wrap gap-1">
                {#each item.additives as a (a.variantId)}
                  <li class="rounded-full bg-honey-50 px-2 py-0.5 text-[11px] text-cocoa-500">
                    {a.name} × {a.qty}
                  </li>
                {/each}
              </ul>
            {/if}
          {:else}
            <div class="flex justify-between gap-2">
              <span class="line-clamp-1">{t(lang, "checkout.itemLine", { name: item.name, variantName: item.variantName, quantity: item.quantity })}</span>
              <span class="font-semibold">{formatEGP(lineTotal(item), lang)}</span>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    <dl class="mt-4 space-y-1 border-t border-cocoa-100 pt-3 text-sm text-cocoa-700">
      <div class="flex justify-between"><dt>{t(lang, "cart.subtotal")}</dt><dd class="font-semibold">{formatEGP(data.totals.subtotal, lang)}</dd></div>
      <div class="flex justify-between"><dt>{t(lang, "cart.shipping")}</dt><dd class="font-semibold">{data.totals.shipping === 0 ? t(lang, "cart.free") : formatEGP(data.totals.shipping, lang)}</dd></div>
      <div class="flex justify-between text-base font-extrabold text-cocoa-900"><dt>{t(lang, "cart.total")}</dt><dd>{formatEGP(data.totals.total, lang)}</dd></div>
    </dl>
    <p class="mt-4 text-xs text-cocoa-400">{t(lang, "checkout.agree")}</p>
  </aside>
</div>