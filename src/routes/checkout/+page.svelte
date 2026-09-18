<script lang="ts">
  import { enhance } from "$app/forms";
  import { tick } from "svelte";
  import { clearCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import { isBlendItem, itemId, lineTotal } from "$lib/cart";
  import { computeShipping, GOVERNORATE_ORDER } from "$lib/shipping";
  import { trackBeginCheckout } from "$lib/analytics-events";
  import Button from "$lib/components/Button.svelte";
  import CartTotals from "$lib/components/CartTotals.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import {
    PAYMENT_METHOD_HINT_KEY,
    PAYMENT_METHOD_LABEL_KEY,
    type V1PaymentMethod,
  } from "$lib/settlement/types";
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

  // Default address resolved once at init; the closure makes the intentional
  // initial-value capture explicit so later `data` refreshes never reset the
  // user's radio choice.
  function initialSavedChoice(): string {
    return data.savedAddresses.find((a) => a.isDefault)?.id ?? "new";
  }
  let savedChoice = $state(initialSavedChoice());

  let name = $state(value("name"));
  let phone = $state(value("phone"));
  let address = $state(value("address"));
  let city = $state(value("city"));
  function initialGovernorate() {
    return (data.governorates.some((g) => g === form?.values?.governorate)
      ? form?.values?.governorate
      : undefined) ?? data.defaultGovernorate;
  }
  let governorate = $state(initialGovernorate());

  function initialPaymentMethod(): V1PaymentMethod {
    const previous = form?.values?.paymentMethod;
    if (
      typeof previous === "string" &&
      (data.paymentMethods as readonly string[]).includes(previous)
    ) {
      return previous as V1PaymentMethod;
    }
    return data.paymentMethods[0] ?? "cod";
  }
  let paymentMethod = $state(initialPaymentMethod());

  const liveTotals = $derived({
    ...data.totals,
    shipping: computeShipping(data.totals.subtotal, governorate),
    total: data.totals.subtotal + computeShipping(data.totals.subtotal, governorate),
  });

  const selectedSaved = $derived(
    savedChoice === "new" ? null : (data.savedAddresses.find((a) => a.id === savedChoice) ?? null),
  );

  // Prefill the shipping fields whenever a saved address is picked. The form
  // stays the source of truth afterwards — editing a picked address never
  // rewrites the stored copy.
  $effect(() => {
    const s = selectedSaved;
    if (s) {
      name = s.name;
      phone = s.phone;
      address = s.address;
      city = s.city;
    }
  });

  $effect(() => {
    if (data.items.length > 0) {
      trackBeginCheckout(
        data.items.map((i) => ({
          name: i.name,
          price: isBlendItem(i) ? i.basePrice : i.price,
          quantity: i.quantity,
        })),
        data.totals.total,
      );
    }
  });
</script>

<svelte:head>
  <title>{t(lang, "checkout.pageTitle")}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<nav class="mt-6 flex items-center gap-3 text-sm text-cocoa-600" aria-label={lang === "ar" ? "خطوات الطلب" : "Checkout steps"}>
  <a href="/cart" class="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-honey-800">{t(lang, "cart.title")}</a>
  <span aria-hidden="true">/</span>
  <span aria-current="step" class="font-semibold text-cocoa-900">{t(lang, "checkout.shippingTitle")}</span>
</nav>
<div class="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
  <form
    method="post"
    action="?/submit"
    use:enhance={() => {
      submitting = true;
      return async ({ result, update }) => {
        if (
          result.type === "redirect" &&
          new URL(result.location, window.location.origin).searchParams.get("replayed") !== "1"
        ) clearCart();
        submitting = false;
        await update();
        if (result.type === "failure") {
          await tick();
          document.querySelector<HTMLInputElement | HTMLSelectElement>('[aria-invalid="true"]')?.focus();
        }
      };
    }}
    class="min-w-0 space-y-5 rounded-2xl border border-cocoa-200 bg-parchment p-4 sm:p-8"
  >
    <input type="hidden" name="nonce" value={data.nonce} />

    <SectionTitle as="h1" className="text-4xl">{t(lang, "checkout.shippingTitle")}</SectionTitle>

    {#if error("cart")}
      <p class="alert-error" role="alert" data-testid="cart-error">{error("cart")}</p>
    {/if}

    {#if data.savedAddresses.length > 0}
      <!-- Radios sharing name="savedAddress" form the group; the fieldset+legend labels it. -->
      <fieldset class="grid gap-2 rounded-2xl border border-cocoa-200 bg-parchment p-5">
        <legend class="px-2 text-sm font-bold text-cocoa-700">
          {t(lang, "checkout.savedAddresses")}
        </legend>
        {#each data.savedAddresses as addr (addr.id)}
          <label class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 has-checked:border-honey-500 has-checked:bg-honey-50">
            <input
              type="radio"
              name="savedAddress"
              value={addr.id}
              bind:group={savedChoice}
              class="accent-honey-600"
            />
            <span class="text-sm"><b>{addr.label}</b> — {addr.name}، {addr.city}، {addr.phone}</span>
          </label>
        {/each}
        <label class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 has-checked:border-honey-500 has-checked:bg-honey-50">
          <input type="radio" name="savedAddress" value="new" bind:group={savedChoice} class="accent-honey-600" />
          <span class="text-sm font-semibold">{t(lang, "checkout.useNewAddress")}</span>
        </label>
      </fieldset>
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="field-label">
        {t(lang, "checkout.name")}
        <input name="name" bind:value={name} autocomplete="name" aria-required="true" aria-invalid={!!error("name")} aria-describedby={error("name") ? "checkout-name-error" : undefined} class="field mt-1" />
        {#if error("name")}<span id="checkout-name-error" class="field-error">{error("name")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.email")}
        <input name="email" type="email" value={value("email")} autocomplete="email" aria-required="true" aria-invalid={!!error("email")} aria-describedby={error("email") ? "checkout-email-error" : undefined} class="field mt-1" />
        {#if error("email")}<span id="checkout-email-error" class="field-error">{error("email")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.phone")}
        <input name="phone" type="tel" inputmode="tel" bind:value={phone} autocomplete="tel" aria-required="true" aria-invalid={!!error("phone")} aria-describedby={error("phone") ? "checkout-phone-error" : undefined} class="field mt-1" />
        {#if error("phone")}<span id="checkout-phone-error" class="field-error">{error("phone")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.city")}
        <input name="city" bind:value={city} autocomplete="address-level2" aria-required="true" aria-invalid={!!error("city")} aria-describedby={error("city") ? "checkout-city-error" : undefined} class="field mt-1" />
        {#if error("city")}<span id="checkout-city-error" class="field-error">{error("city")}</span>{/if}
      </label>
    </div>
    <label class="field-label">
      {t(lang, "checkout.governorate")}
      <select name="governorate" bind:value={governorate} autocomplete="address-level1" aria-invalid={!!error("governorate")} aria-describedby={error("governorate") ? "checkout-governorate-error" : undefined} class="field mt-1" data-testid="governorate">
        {#each data.governorates as code (code)}
          <option value={code}>{t(lang, `shipping.zone.${code}`)}</option>
        {/each}
      </select>
      {#if error("governorate")}<span id="checkout-governorate-error" class="field-error">{error("governorate")}</span>{/if}
    </label>
    <label class="field-label">
      {t(lang, "checkout.address")}
      <input name="address" bind:value={address} autocomplete="street-address" aria-required="true" aria-invalid={!!error("address")} aria-describedby={error("address") ? "checkout-address-error" : undefined} class="field mt-1" />
      {#if error("address")}<span id="checkout-address-error" class="field-error">{error("address")}</span>{/if}
    </label>

    {#if data.isLoggedIn && savedChoice === "new"}
      <label class="flex items-center gap-2 text-sm text-cocoa-700">
        <input type="checkbox" name="saveAddress" class="accent-honey-600" />
        {t(lang, "checkout.saveThisAddress")}
      </label>
    {/if}

    <fieldset class="rounded-2xl border border-cocoa-200 bg-cocoa-50/50 p-5">
      <legend class="px-2 text-sm font-bold text-cocoa-800">{t(lang, "checkout.paymentTitle")}</legend>
      <div class="mt-1 space-y-3">
        {#each data.paymentMethods as method (method)}
          <label class="flex cursor-pointer items-start gap-3 text-sm text-cocoa-800">
            <input
              type="radio"
              name="paymentMethod"
              value={method}
              bind:group={paymentMethod}
              required
              class="mt-0.5 accent-honey-600"
            />
            <span>
              <span class="block font-semibold">{t(lang, PAYMENT_METHOD_LABEL_KEY[method])}</span>
              <span class="block text-xs text-cocoa-500">{t(lang, PAYMENT_METHOD_HINT_KEY[method])}</span>
            </span>
          </label>
        {/each}
      </div>
      {#if data.paymentMethods.length === 0}
        <p class="mt-1 text-sm font-semibold text-clay-800" role="alert">{t(lang, "checkout.noMethods")}</p>
      {/if}
      {#if error("paymentMethod")}<span class="field-error">{error("paymentMethod")}</span>{/if}
    </fieldset>

    <Button
      variant="primary"
      type="submit"
      disabled={submitting || data.paymentMethods.length === 0}
      aria-busy={submitting}
      class="w-full"
    >{submitting ? t(lang, "checkout.submitting") : t(lang, "checkout.submit")}</Button>
  </form>

  <aside class="min-w-0 rounded-2xl border border-cocoa-200 bg-parchment p-5 lg:sticky lg:top-40">
    <h2 class="headline text-xl text-cocoa-900">{t(lang, "cart.summary")}</h2>
    <ul class="mt-4 space-y-3">
      {#each data.items as item (itemId(item))}
        <li class="flex flex-col gap-1 text-sm text-cocoa-700">
          {#if isBlendItem(item)}
            <div class="flex justify-between gap-2">
              <span class="min-w-0 break-words">
                {item.name} ({item.variantName}) × 1
              </span>
              <span class="shrink-0 font-semibold tabular-nums">{formatEGP(lineTotal(item), lang)}</span>
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
              <span class="min-w-0 break-words">{t(lang, "checkout.itemLine", { name: item.name, variantName: item.variantName, quantity: item.quantity })}</span>
              <span class="shrink-0 font-semibold tabular-nums">{formatEGP(lineTotal(item), lang)}</span>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    <CartTotals totals={liveTotals} {lang} />
    <p class="mt-4 text-sm leading-relaxed text-cocoa-600">{t(lang, "checkout.agree")}</p>
  </aside>
</div>
