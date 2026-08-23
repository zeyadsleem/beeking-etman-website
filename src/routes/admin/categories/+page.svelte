<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  type CategoryRow = PageData["categories"][number];

  // Inline add/edit form state. A full-page POST reload resets it naturally.
  let editingId = $state<string | null>(null);
  let name = $state("");
  let nameEn = $state("");
  let slug = $state("");

  function startEdit(category: CategoryRow): void {
    editingId = category.id;
    name = category.name;
    nameEn = category.nameEn;
    slug = category.slug;
  }

  function resetForm(): void {
    editingId = null;
    name = "";
    nameEn = "";
    slug = "";
  }

  function confirmDelete(event: SubmitEvent): void {
    if (!window.confirm(t(lang, "admin.categories.confirmDelete"))) event.preventDefault();
  }
</script>

<svelte:head>
  <title>{t(lang, "admin.categories.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.categories.title")}</SectionTitle>

  {#if form?.message}
    <p role="alert" class="mt-2 text-sm font-semibold text-red-700">{form.message}</p>
  {/if}

  <form
    method="POST"
    action="?/save"
    class="mt-6 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm"
  >
    <h2 class="text-lg font-bold text-cocoa-900">
      {editingId === null ? t(lang, "admin.categories.new") : t(lang, "admin.categories.edit")}
    </h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label for="category-name" class="mb-1 block text-sm font-semibold text-cocoa-700">
          {t(lang, "account.name")}
        </label>
        <input
          id="category-name"
          name="name"
          type="text"
          required
          maxlength="120"
          bind:value={name}
          class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
        />
      </div>
      <div>
        <label for="category-name-en" class="mb-1 block text-sm font-semibold text-cocoa-700">
          {t(lang, "admin.categories.nameEn")}
        </label>
        <input
          id="category-name-en"
          name="nameEn"
          type="text"
          maxlength="120"
          bind:value={nameEn}
          class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
        />
      </div>
      <div>
        <label for="category-slug" class="mb-1 block text-sm font-semibold text-cocoa-700">
          {t(lang, "admin.categories.slug")}
        </label>
        <input
          id="category-slug"
          name="slug"
          type="text"
          maxlength="120"
          bind:value={slug}
          class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
        />
      </div>
    </div>
    {#if editingId !== null}
      <input type="hidden" name="id" value={editingId} />
    {/if}
    <div class="mt-4 flex gap-3">
      <Button type="submit" variant="primary">{t(lang, "admin.categories.save")}</Button>
      {#if editingId !== null}
        <Button type="button" variant="ghost" onclick={resetForm}>
          {t(lang, "addresses.cancel")}
        </Button>
      {/if}
    </div>
  </form>

  <div class="mt-8 overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-cocoa-100 text-xs font-semibold text-cocoa-500">
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "account.name")}</th>
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.categories.nameEn")}</th>
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.categories.slug")}</th>
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.categories.count")}</th>
          <th scope="col" class="px-6 py-3 text-end"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.categories as category (category.id)}
          <tr class="border-b border-cocoa-50 last:border-b-0">
            <td class="px-6 py-3 font-medium text-cocoa-800">{category.name}</td>
            <td class="px-6 py-3 text-cocoa-600">{category.nameEn}</td>
            <td class="px-6 py-3 text-cocoa-600">{category.slug}</td>
            <td class="px-6 py-3 text-cocoa-600">{category.productCount}</td>
            <td class="px-6 py-3">
              <div class="flex items-center justify-end gap-2">
                {#if editingId === category.id}
                  <Button type="button" variant="ghost" onclick={resetForm}>
                    {t(lang, "addresses.cancel")}
                  </Button>
                {:else}
                  <Button type="button" variant="ghost" onclick={() => startEdit(category)}>
                    {t(lang, "admin.categories.edit")}
                  </Button>
                {/if}
                <form method="POST" action="?/delete" onsubmit={confirmDelete}>
                  <input type="hidden" name="id" value={category.id} />
                  <button
                    type="submit"
                    class="text-sm font-semibold text-clay-700 underline-offset-4 transition hover:text-clay-900 hover:underline"
                  >
                    {t(lang, "admin.categories.delete")}
                  </button>
                </form>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
