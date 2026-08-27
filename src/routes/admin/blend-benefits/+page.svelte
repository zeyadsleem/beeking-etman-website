<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  type BenefitRow = PageData["benefits"][number];

  let editingKey = $state<string | null>(null);
  let valueAr = $state("");
  let valueEn = $state("");

  function startEdit(benefit: BenefitRow): void {
    editingKey = benefit.key;
    valueAr = benefit.valueAr;
    valueEn = benefit.valueEn;
  }

  function resetForm(): void {
    editingKey = null;
    valueAr = "";
    valueEn = "";
  }

  const savedKey = $derived(form && "savedKey" in form ? form.savedKey : null);
</script>

<svelte:head>
  <title>{t(lang, "admin.benefits.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-4xl px-4 py-10">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.benefits.title")}</SectionTitle>

  {#if form?.message}
    <p role="alert" class="mt-2 text-sm font-semibold text-red-700">{form.message}</p>
  {/if}
  {#if form && "saved" in form}
    <p role="status" class="mt-2 text-sm font-semibold text-green-700">
      {t(lang, "admin.benefits.saved")}
    </p>
  {/if}

  <div class="mt-8 overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-cocoa-100 text-xs font-semibold text-cocoa-500">
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.benefits.key")}</th>
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.benefits.valueAr")}</th>
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.benefits.valueEn")}</th>
          <th scope="col" class="px-6 py-3 text-end"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.benefits as benefit (benefit.key)}
          <tr class="border-b border-cocoa-50 last:border-b-0">
            <td class="px-6 py-3 font-medium text-cocoa-800">{benefit.key}</td>
            {#if editingKey === benefit.key}
              <td class="px-6 py-3" colspan="3">
                <form method="POST" action="?/save" class="space-y-3">
                  <input type="hidden" name="key" value={benefit.key} />
                  <div>
                    <label for={`ar-${benefit.key}`} class="mb-1 block text-xs font-semibold text-cocoa-500">
                      {t(lang, "admin.benefits.valueAr")}
                    </label>
                    <textarea
                      id={`ar-${benefit.key}`}
                      name="valueAr"
                      rows="3"
                      bind:value={valueAr}
                      class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
                    ></textarea>
                  </div>
                  <div>
                    <label for={`en-${benefit.key}`} class="mb-1 block text-xs font-semibold text-cocoa-500">
                      {t(lang, "admin.benefits.valueEn")}
                    </label>
                    <textarea
                      id={`en-${benefit.key}`}
                      name="valueEn"
                      rows="3"
                      bind:value={valueEn}
                      class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
                    ></textarea>
                  </div>
                  <div class="flex gap-2">
                    <Button type="submit" variant="primary">{t(lang, "admin.categories.save")}</Button>
                    <Button type="button" variant="ghost" onclick={resetForm}>
                      {t(lang, "addresses.cancel")}
                    </Button>
                  </div>
                </form>
              </td>
            {:else}
              <td class="max-w-xs truncate px-6 py-3 text-cocoa-600">{benefit.valueAr}</td>
              <td class="max-w-xs truncate px-6 py-3 text-cocoa-600">{benefit.valueEn}</td>
              <td class="px-6 py-3">
                <div class="flex items-center justify-end">
                  <Button type="button" variant="ghost" onclick={() => startEdit(benefit)}>
                    {t(lang, "admin.categories.edit")}
                  </Button>
                </div>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <a href="/admin" class="mt-6 inline-block text-sm font-semibold text-honey-700 hover:underline">
    ← {t(lang, "admin.audit.backToDashboard")}
  </a>
</section>
