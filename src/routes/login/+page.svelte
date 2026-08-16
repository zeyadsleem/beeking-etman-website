<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/Button.svelte";
  import { t } from "$lib/i18n/messages";

  import type { ActionData, PageData } from "./$types";

  let { form, data }: { form: ActionData; data: PageData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head><title>{t(lang, "login.title")}</title></svelte:head>

<div class="mx-auto mt-14 max-w-md motion-safe:animate-fade-up">
  <div class="mb-8 flex flex-col items-center text-center">
    <img src="/images/logo.png" alt={t(lang, "brand.name")} class="h-9 w-9 object-contain" />
    <h1 class="headline mt-3 text-3xl text-cocoa-900">{t(lang, "login.heading")}</h1>
    <p class="mt-1 text-sm text-cocoa-500">{t(lang, "login.helper")}</p>
  </div>
  <form method="post" action="?/signIn" use:enhance class="space-y-4 rounded-2xl border border-cocoa-100 bg-parchment p-7 shadow-warm-sm">
    {#if form?.message}
      <p class="rounded-xl bg-clay-50 px-4 py-3 text-sm font-semibold text-clay-700" role="alert">{form.message}</p>
    {/if}
    <label class="field-label">
      {t(lang, "login.email")}
      <input name="email" type="email" autocomplete="email" required class="field mt-1" />
    </label>
    <label class="field-label">
      {t(lang, "login.password")}
      <input name="password" type="password" autocomplete="current-password" required class="field mt-1" />
    </label>
    <Button variant="primary" type="submit" class="w-full">{t(lang, "login.submit")}</Button>
    <p class="text-center text-sm text-cocoa-500">{t(lang, "login.noAccount")} <a href="/register" class="font-semibold text-honey-700 underline decoration-honey-300 underline-offset-4 hover:text-honey-800">{t(lang, "login.signup")}</a></p>
  </form>
</div>