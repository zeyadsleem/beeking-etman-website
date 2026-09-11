<script lang="ts">
  import { enhance } from "$app/forms";
  import AuthShell from "$lib/components/AuthShell.svelte";
  import Button from "$lib/components/Button.svelte";
  import { t } from "$lib/i18n/messages";

  import type { ActionData, PageData } from "./$types";

  let { form, data }: { form: ActionData; data: PageData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head>
  <title>{t(lang, "register.title")}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AuthShell {lang} title={t(lang, "register.heading")} helper={t(lang, "register.helper")}>
  <!-- The named action replaces the query string, so redirectTo must ride along explicitly. -->
  <form
    method="post"
    action={`?/register&redirectTo=${encodeURIComponent(data.redirectTo)}`}
    use:enhance
    class="space-y-4"
  >
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
</AuthShell>
