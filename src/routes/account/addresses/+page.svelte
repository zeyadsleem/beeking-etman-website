<script lang="ts">
  import { enhance } from "$app/forms";
  import { Dialog } from "bits-ui";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import AddressDialog from "$lib/components/account/AddressDialog.svelte";
  import { t } from "$lib/i18n/messages";
  import type { AddressInput, SavedAddress } from "$lib/server/addresses";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  let addEditOpen = $state(false);
  let editing: SavedAddress | null = $state(null);
  let confirmOpen = $state(false);
  let deleting: SavedAddress | null = $state(null);

  const emptyFields: AddressInput = {
    label: "",
    name: "",
    phone: "",
    city: "",
    address: "",
  };
  let fields: AddressInput = $state({ ...emptyFields });

  function openAdd(): void {
    // Clear stale ActionData so errors from a previous action (e.g. a failed
    // delete or validation) don't render inside the freshly opened dialog.
    form = null;
    editing = null;
    fields = { ...emptyFields };
    addEditOpen = true;
  }

  function openEdit(address: SavedAddress): void {
    form = null;
    editing = address;
    fields = {
      label: address.label,
      name: address.name,
      phone: address.phone,
      city: address.city,
      address: address.address,
    };
    addEditOpen = true;
  }

  function askDelete(address: SavedAddress): void {
    deleting = address;
    confirmOpen = true;
  }
</script>

<svelte:head><title>{t(lang, "addresses.title")} — {t(lang, "brand.name")}</title></svelte:head>

<div class="mx-auto mt-8 mb-16 w-full max-w-2xl px-4">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "addresses.title")}</SectionTitle>

  <div class="mt-6">
    <Button variant="primary" onclick={openAdd}>{t(lang, "addresses.add")}</Button>
  </div>

  {#if form?.errors?.label && !addEditOpen}
    <p role="alert" class="mt-4 text-sm font-semibold text-red-700">{form.errors.label}</p>
  {/if}

  {#if data.addresses.length === 0}
    <p class="mt-8 text-cocoa-500">{t(lang, "addresses.empty")}</p>
  {:else}
    <ul class="mt-6 space-y-4">
      {#each data.addresses as address (address.id)}
        <li class="rounded-2xl border border-cocoa-200 bg-parchment p-5" data-testid="address-card">
          <header class="flex items-center justify-between gap-2">
            <h2 class="font-bold text-cocoa-900">{address.label}</h2>
            {#if address.isDefault === 1}
              <span class="badge-warn shrink-0">{t(lang, "addresses.default")}</span>
            {/if}
          </header>
          <dl class="mt-3 space-y-1 text-sm text-cocoa-700">
            <div class="flex gap-2">
              <dt class="font-semibold">{t(lang, "addresses.name")}:</dt>
              <dd>{address.name}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-semibold">{t(lang, "addresses.phone")}:</dt>
              <dd dir="ltr">{address.phone}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-semibold">{t(lang, "addresses.address")}:</dt>
              <dd>{address.city} — {address.address}</dd>
            </div>
          </dl>
          <footer class="mt-4 flex flex-wrap items-center gap-2">
            {#if address.isDefault !== 1}
              <form method="POST" action="?/setDefault" use:enhance>
                <input type="hidden" name="id" value={address.id} />
                <Button type="submit" variant="ghost">{t(lang, "addresses.setDefault")}</Button>
              </form>
            {/if}
            <Button variant="outline" onclick={() => openEdit(address)}>
              {t(lang, "addresses.edit")}
            </Button>
            <Button variant="outline" onclick={() => askDelete(address)}>
              {t(lang, "addresses.delete")}
            </Button>
          </footer>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<AddressDialog {lang} {fields} address={editing} errors={form?.errors} bind:open={addEditOpen} />

<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-cocoa-950/40 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-sm -translate-y-1/2 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-lg focus:outline-none"
      data-testid="delete-confirm-dialog"
    >
      <Dialog.Title class="headline text-xl text-cocoa-900">
        {t(lang, "addresses.delete")}
      </Dialog.Title>
      <Dialog.Description class="sr-only">{deleting?.label ?? ""}</Dialog.Description>
      <p class="mt-3 text-sm text-cocoa-700">{t(lang, "addresses.confirmDelete")}</p>
      <form
        method="POST"
        action="?/delete"
        use:enhance={() => {
          return async ({ result, update }) => {
            if (result.type === "success") confirmOpen = false;
            await update();
          };
        }}
        class="mt-5 flex items-center justify-end gap-2"
      >
        <input type="hidden" name="id" value={deleting?.id ?? ""} />
        <Dialog.Close class="btn-outline">{t(lang, "addresses.cancel")}</Dialog.Close>
        <Button type="submit" variant="primary">{t(lang, "addresses.delete")}</Button>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
