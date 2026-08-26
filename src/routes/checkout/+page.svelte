<script lang="ts">
  import { enhance } from "$app/forms";
  import { clearCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import { isBlendItem, itemId, lineTotal } from "$lib/cart";
  import Button from "$lib/components/Button.svelte";
  import CartTotals from "$lib/components/CartTotals.svelte";
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
</script>

<svelte:head>
  <title>{t(lang, "checkout.pageTitle")}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
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
        <input name="name" bind:value={name} autocomplete="name" class="field mt-1" />
        {#if error("name")}<span class="field-error">{error("name")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.email")}
        <input name="email" type="email" value={value("email")} autocomplete="email" class="field mt-1" />
        {#if error("email")}<span class="field-error">{error("email")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.phone")}
        <input name="phone" inputmode="tel" bind:value={phone} autocomplete="tel" class="field mt-1" />
        {#if error("phone")}<span class="field-error">{error("phone")}</span>{/if}
      </label>
      <label class="field-label">
        {t(lang, "checkout.city")}
        <input name="city" bind:value={city} class="field mt-1" />
        {#if error("city")}<span class="field-error">{error("city")}</span>{/if}
      </label>
    </div>
    <label class="field-label">
      {t(lang, "checkout.address")}
      <input name="address" bind:value={address} autocomplete="street-address" class="field mt-1" />
      {#if error("address")}<span class="field-error">{error("address")}</span>{/if}
    </label>

    {#if data.isLoggedIn && savedChoice === "new"}
      <label class="flex items-center gap-2 text-sm text-cocoa-700">
        <input type="checkbox" name="saveAddress" class="accent-honey-600" />
        {t(lang, "checkout.saveThisAddress")}
      </label>
    {/if}

    <fieldset class="rounded-2xl border border-cocoa-200 bg-cocoa-50/50 p-5">
      <legend class="px-2 text-sm font-bold text-cocoa-800">{t(lang, "checkout.paymentTitle")}</legend>
      <p class="text-xs text-cocoa-500">{t(lang, "checkout.paymentNote")}</p>
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
    <CartTotals totals={data.totals} {lang} />
    <p class="mt-4 text-xs text-cocoa-400">{t(lang, "checkout.agree")}</p>
  </aside>
</div>