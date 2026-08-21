<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/Button.svelte";
  import Logo from "$lib/components/Logo.svelte";
  import { t } from "$lib/i18n/messages";

  import type { ActionData, PageData } from "./$types";

  let { form, data }: { form: ActionData; data: PageData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head><title>{t(lang, "register.title")}</title></svelte:head>

<div class="mx-auto mt-14 max-w-md motion-safe:animate-fade-up">
  <div class="mb-8 flex flex-col items-center text-center">
    <Logo alt={t(lang, "brand.name")} class="h-11 w-11" />
    <h1 class="headline mt-3 text-3xl text-cocoa-900">{t(lang, "register.heading")}</h1>
    <p class="mt-1 text-sm text-cocoa-500">{t(lang, "register.helper")}</p>
  </div>
  <form method="post" action="?/register" use:enhance class="space-y-4 rounded-2xl border border-cocoa-100 bg-parchment p-7 shadow-warm-sm">
    {#if form?.message}
      <p class="alert-error" role="alert">{form.message}</p>
    {/if}
    <label class="field-label">
      {t(lang, "register.name")}
      <input name="name" autocomplete="name" required class="field mt-1" />
    </label>
    <label class="field-label">
      {t(lang, "register.email")}
      <input name="email" type="email" autocomplete="email" required class="field mt-1" />
    </label>
    <label class="field-label">
      {t(lang, "register.password")}
      <input name="password" type="password" autocomplete="new-password" required minlength="8" class="field mt-1" />
    </label>
    <Button variant="primary" type="submit" class="w-full">{t(lang, "register.submit")}</Button>
    <p class="text-center text-sm text-cocoa-500">{t(lang, "register.haveAccount")} <a href="/login" class="font-semibold text-honey-700 underline decoration-honey-300 underline-offset-4 hover:text-honey-800">{t(lang, "register.login")}</a></p>
  </form>
</div>