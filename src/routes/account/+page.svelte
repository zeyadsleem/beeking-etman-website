<script lang="ts">
  import LogOut from "@lucide/svelte/icons/log-out";
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

<div class="mx-auto w-full max-w-2xl">
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
    <form method="POST" action="?/updateName" class="mt-5 max-w-md">
      <label class="field-label" for="account-name">{t(lang, "account.name")}</label>
      <input
        id="account-name"
        class="field mt-2"
        name="name" required minlength="2" maxlength="80" bind:value={name}
        aria-label={t(lang, "account.name")}
      />
      <div class="mt-3">
        <Button type="submit" variant="primary" class="whitespace-nowrap">
          {t(lang, "account.saveName")}
        </Button>
      </div>
    </form>
    {#if data.user.email !== undefined}
      <p class="mt-4 text-sm text-cocoa-600">
        {t(lang, "account.email")}: <span class="font-semibold">{data.user.email}</span>
        <span class="block text-xs">{t(lang, "account.emailReadonly")}</span>
      </p>
    {/if}
    {#if form?.nameSaved}
      <p class="mt-3 text-sm font-semibold text-honey-700">{t(lang, "account.nameSaved")}</p>
    {/if}
    {#if form?.nameError}
      <p role="alert" class="mt-3 text-sm font-semibold text-red-700">{form.nameError}</p>
    {/if}
  </section>

  <form method="POST" action="?/signOut" class="mt-8 mb-16">
    <Button
      type="submit"
      variant="outline"
      class="border-clay-300 text-clay-700 hover:border-clay-500 hover:bg-clay-50 hover:text-clay-900 dark:hover:bg-clay-950"
    >
      <LogOut class="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      <span class="whitespace-nowrap">{t(lang, "account.signOut")}</span>
    </Button>
  </form>
</div>
