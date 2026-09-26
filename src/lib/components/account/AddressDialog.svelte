<script lang="ts">
  import { enhance } from "$app/forms";
  import { Dialog } from "bits-ui";
  import Button from "$lib/components/Button.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { AddressInput, SavedAddress } from "$lib/server/addresses";

  let {
    lang,
    fields,
    address = null,
    errors = {},
    open = $bindable(false),
  }: {
    lang: Lang;
    /** Two-way bound field values; the owner reseeds them when reopening. */
    fields: AddressInput;
    /** Address being edited, or null to create a new one. */
    address?: SavedAddress | null;
    errors?: Record<string, string>;
    open?: boolean;
  } = $props();

  let submitting = $state(false);

  const action = $derived(address === null ? "?/create" : "?/update");
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[85vh] w-full max-w-lg -translate-y-1/2 overflow-y-auto rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-lg focus:outline-none"
      data-testid="address-dialog"
    >
      <header class="flex items-center justify-between">
        <Dialog.Title class="headline text-xl text-cocoa-900">
          {t(lang, address === null ? "addresses.add" : "addresses.edit")}
        </Dialog.Title>
        <Dialog.Description class="sr-only">
          {t(lang, "addresses.formDescription")}
        </Dialog.Description>
        <Dialog.Close
          class="grid h-9 w-9 place-items-center rounded-full text-cocoa-400 transition-colors hover:bg-cocoa-100 hover:text-cocoa-900"
          aria-label={t(lang, "addresses.close")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </Dialog.Close>
      </header>

      <form
        method="POST"
        action={action}
        use:enhance={() => {
          submitting = true;
          return async ({ result, update }) => {
            if (result.type === "success") open = false;
            submitting = false;
            await update();
          };
        }}
        class="mt-4 grid gap-3"
      >
        {#if address !== null}
          <input type="hidden" name="id" value={address.id} />
        {/if}

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="field-label">
            {t(lang, "addresses.label")}
            <input
              name="label"
              bind:value={fields.label}
              required
              minlength="2"
              maxlength="40"
              class="field mt-1"
            />
            {#if errors.label}<span class="field-error">{errors.label}</span>{/if}
          </label>
          <label class="field-label">
            {t(lang, "addresses.name")}
            <input
              name="name"
              bind:value={fields.name}
              autocomplete="name"
              required
              minlength="2"
              maxlength="80"
              class="field mt-1"
            />
            {#if errors.name}<span class="field-error">{errors.name}</span>{/if}
          </label>
          <label class="field-label">
            {t(lang, "addresses.phone")}
            <input
              name="phone"
              bind:value={fields.phone}
              inputmode="tel"
              autocomplete="tel"
              required
              maxlength="20"
              dir="ltr"
              class="field mt-1"
            />
            {#if errors.phone}<span class="field-error">{errors.phone}</span>{/if}
          </label>
          <label class="field-label">
            {t(lang, "addresses.city")}
            <input
              name="city"
              bind:value={fields.city}
              autocomplete="address-level2"
              required
              minlength="2"
              maxlength="60"
              class="field mt-1"
            />
            {#if errors.city}<span class="field-error">{errors.city}</span>{/if}
          </label>
        </div>
        <label class="field-label">
          {t(lang, "addresses.address")}
          <input
            name="address"
            bind:value={fields.address}
            autocomplete="street-address"
            required
            minlength="5"
            maxlength="200"
            class="field mt-1"
          />
          {#if errors.address}<span class="field-error">{errors.address}</span>{/if}
        </label>

        <footer class="mt-2 flex items-center justify-end gap-2">
          <Dialog.Close class="btn-outline">{t(lang, "addresses.cancel")}</Dialog.Close>
          <Button variant="primary" type="submit" disabled={submitting} aria-busy={submitting}>
            {t(lang, "addresses.save")}
          </Button>
        </footer>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
