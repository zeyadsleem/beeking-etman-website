<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  // Seed the editable field once from load data; edits stay local until saved.
  // svelte-ignore state_referenced_locally
  let name = $state(data.user.name ?? "");

  // Initials avatar: first letter of first and last name-word.
  function initials(value: string | null | undefined): string {
    const words = (value ?? "").trim().split(/\s+/).filter(Boolean);
    const first = words[0]?.[0] ?? "";
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase() || "؟";
  }
</script>

<svelte:head><title>{t(lang, "account.title")} — {t(lang, "brand.name")}</title></svelte:head>

<div class="mx-auto mt-8 w-full max-w-2xl px-4">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "account.title")}</SectionTitle>

  <section class="mt-6 flex items-center gap-4 rounded-2xl border border-cocoa-200 bg-parchment p-6">
    <span
      class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-honey-100 text-2xl font-bold text-honey-700"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
    <div class="min-w-0">
      <p class="text-lg font-bold text-cocoa-800">{data.user.name ?? "—"}</p>
      <p class="truncate text-sm text-cocoa-500">{data.user.email}</p>
    </div>
  </section>

  <section class="mt-6 rounded-2xl border border-cocoa-200 bg-parchment p-6">
    <h2 class="text-xl font-bold text-cocoa-800">{t(lang, "account.name")}</h2>
    <form method="POST" action="?/updateName" class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <input
        class="w-full rounded-xl border border-cocoa-300 bg-white px-4 py-2.5"
        name="name" required minlength="2" maxlength="80" bind:value={name}
        aria-label={t(lang, "account.name")}
      />
      <Button type="submit" variant="primary">{t(lang, "account.saveName")}</Button>
    </form>
    {#if data.user.email !== undefined}
      <p class="mt-4 text-sm text-cocoa-600">
        {t(lang, "account.email")}: <span class="font-semibold">{data.user.email}</span>
        <span class="block text-xs">{t(lang, "account.emailReadonly")}</span>
      </p>
    {/if}
    {#if form?.nameSaved}<p class="mt-2 text-sm font-semibold text-honey-700">{t(lang, "account.nameSaved")}</p>{/if}
    {#if form?.nameError}<p role="alert" class="mt-2 text-sm font-semibold text-red-700">{form.nameError}</p>{/if}
  </section>

  <form method="POST" action="?/signOut" class="mt-8 mb-16">
    <Button type="submit" variant="ghost">{t(lang, "account.signOut")}</Button>
  </form>
</div>
