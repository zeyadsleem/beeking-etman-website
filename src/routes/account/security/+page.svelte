<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head><title>{t(lang, "account.securityTitle")} — {t(lang, "brand.name")}</title></svelte:head>

<div class="mx-auto mt-8 w-full max-w-2xl px-4">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "account.securityTitle")}</SectionTitle>

  <section class="mt-6 rounded-2xl border border-cocoa-200 bg-parchment p-6">
    <div class="flex items-center gap-2">
      <LockKeyhole class="h-5 w-5 text-honey-600" aria-hidden="true" />
      <h2 class="text-xl font-bold text-cocoa-800">{t(lang, "account.changePassword")}</h2>
    </div>
    <p class="mt-1 text-sm text-cocoa-500">{t(lang, "account.passwordHint")}</p>
    <form method="POST" action="?/changePassword" class="mt-4 grid gap-3">
      <label class="field-label">
        {t(lang, "account.currentPassword")}
        <input type="password" name="currentPassword" required autocomplete="current-password" class="field mt-1" />
      </label>
      <label class="field-label">
        {t(lang, "account.newPassword")}
        <input type="password" name="newPassword" required minlength="8" autocomplete="new-password" class="field mt-1" />
      </label>
      <div class="mt-1">
        <Button type="submit" variant="primary">{t(lang, "account.changePassword")}</Button>
      </div>
    </form>
    {#if form?.passwordChanged}<p class="mt-2 text-sm font-semibold text-honey-700">{t(lang, "account.passwordChanged")}</p>{/if}
    {#if form?.passwordError}<p role="alert" class="mt-2 text-sm font-semibold text-red-700">{form.passwordError}</p>{/if}
  </section>
</div>
