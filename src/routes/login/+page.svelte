<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>تسجيل الدخول — بيت العسل</title></svelte:head>

<div class="mx-auto mt-12 max-w-md">
  <h1 class="text-2xl font-extrabold">تسجيل الدخول</h1>
  <p class="mt-1 text-sm text-stone-500">لا تحتاج حسابًا للشراء — يمكنك الدخول لمتابعة طلباتك.</p>
  <form method="post" action="?/signIn" use:enhance class="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
    {#if form?.message}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{form.message}</p>
    {/if}
    <label class="block text-sm font-medium">
      البريد الإلكتروني
      <input name="email" type="email" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <label class="block text-sm font-medium">
      كلمة المرور
      <input name="password" type="password" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <button type="submit" class="w-full rounded-full bg-honey-600 py-3 font-bold text-white hover:bg-honey-700">دخول</button>
    <p class="text-center text-sm text-stone-500">ليس لديك حساب؟ <a href="/register" class="font-semibold text-honey-700 hover:underline">أنشئ حسابًا</a></p>
  </form>
</div>