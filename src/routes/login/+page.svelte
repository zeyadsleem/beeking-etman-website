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
  <title>{t(lang, "login.title")}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AuthShell {lang} title={t(lang, "login.heading")} helper={t(lang, "login.helper")}>
  <!-- The named action replaces the query string, so redirectTo must ride along explicitly. -->
  <form
    method="post"
    action={`?/signIn&redirectTo=${encodeURIComponent(data.redirectTo)}`}
    use:enhance
    class="space-y-4"
  >
    {#if form?.message}
      <p class="alert-error" role="alert">{form.message}</p>
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
</AuthShell>
