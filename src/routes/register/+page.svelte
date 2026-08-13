<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>إنشاء حساب — بيت العسل</title></svelte:head>

<div class="mx-auto mt-12 max-w-md">
  <h1 class="text-2xl font-extrabold">إنشاء حساب</h1>
  <form method="post" action="?/register" use:enhance class="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
    {#if form?.message}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{form.message}</p>
    {/if}
    <label class="block text-sm font-medium">
      الاسم
      <input name="name" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <label class="block text-sm font-medium">
      البريد الإلكتروني
      <input name="email" type="email" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <label class="block text-sm font-medium">
      كلمة المرور
      <input name="password" type="password" required minlength="8" class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <button type="submit" class="w-full rounded-full bg-honey-600 py-3 font-bold text-white hover:bg-honey-700">إنشاء الحساب</button>
    <p class="text-center text-sm text-stone-500">لديك حساب بالفعل؟ <a href="/login" class="font-semibold text-honey-700 hover:underline">سجّل الدخول</a></p>
  </form>
</div>