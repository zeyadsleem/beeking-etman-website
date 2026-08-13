<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>تسجيل الدخول — بيت العسل</title></svelte:head>

<div class="mx-auto mt-14 max-w-md motion-safe:animate-fade-up">
  <div class="mb-6 flex flex-col items-center text-center">
    <svg width="42" height="48" viewBox="0 0 26 30" fill="none" aria-hidden="true">
      <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="#f3da99" stroke="#a35110" stroke-width="1.4" />
      <path d="M8.2 12.5h9.6M13 7.5v10" stroke="#a35110" stroke-width="1.6" stroke-linecap="round" />
    </svg>
    <h1 class="headline mt-2 text-3xl text-cocoa-900">تسجيل الدخول</h1>
    <p class="mt-1 text-sm text-cocoa-500">لا تحتاج حسابًا للشراء — يمكنك الدخول لمتابعة طلباتك.</p>
  </div>
  <form method="post" action="?/signIn" use:enhance class="honeycomb-bg space-y-4 rounded-[1.8rem] border border-cocoa-100 bg-parchment p-7 shadow-warm">
    {#if form?.message}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{form.message}</p>
    {/if}
    <label class="field-label">
      البريد الإلكتروني
      <input name="email" type="email" autocomplete="email" required class="field mt-1" />
    </label>
    <label class="field-label">
      كلمة المرور
      <input name="password" type="password" autocomplete="current-password" required class="field mt-1" />
    </label>
    <button type="submit" class="btn-honey w-full">دخول</button>
    <p class="text-center text-sm text-cocoa-500">ليس لديك حساب؟ <a href="/register" class="font-semibold text-honey-700 underline decoration-honey-300 underline-offset-4 hover:text-honey-800">أنشئ حسابًا</a></p>
  </form>
</div>