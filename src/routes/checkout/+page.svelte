<script lang="ts">
  import { enhance } from "$app/forms";
  import Price from "$lib/components/Price.svelte";
  import { formatEGP } from "$lib/currency";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  function value(name: string) {
    return form?.values ? String(form.values[name] ?? "") : "";
  }
  function error(name: string) {
    const errors = form?.errors as Record<string, string> | undefined;
    return errors?.[name] ?? "";
  }
</script>

<svelte:head><title>إتمام الشراء — بيت العسل</title></svelte:head>

<div class="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
  <form method="post" action="?/submit" use:enhance class="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
    <h1 class="text-2xl font-extrabold">معلومات التوصيل</h1>

    {#if error("cart")}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert" data-testid="cart-error">{error("cart")}</p>
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm font-medium">
        الاسم بالكامل *
        <input name="name" value={value("name")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("name")}<span class="mt-1 block text-xs text-red-600">{error("name")}</span>{/if}
      </label>
      <label class="block text-sm font-medium">
        البريد الإلكتروني *
        <input name="email" type="email" value={value("email")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("email")}<span class="mt-1 block text-xs text-red-600">{error("email")}</span>{/if}
      </label>
      <label class="block text-sm font-medium">
        رقم الهاتف *
        <input name="phone" inputmode="tel" value={value("phone")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("phone")}<span class="mt-1 block text-xs text-red-600">{error("phone")}</span>{/if}
      </label>
      <label class="block text-sm font-medium">
        المدينة *
        <input name="city" value={value("city")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("city")}<span class="mt-1 block text-xs text-red-600">{error("city")}</span>{/if}
      </label>
    </div>
    <label class="block text-sm font-medium">
      العنوان بالتفصيل *
      <input name="address" value={value("address")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
      {#if error("address")}<span class="mt-1 block text-xs text-red-600">{error("address")}</span>{/if}
    </label>

    <fieldset class="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <legend class="px-2 text-sm font-bold">الدفع</legend>
      <p class="mb-4 text-xs text-stone-500">مرحلة تجريبية — لن تُخصم أي مبالغ من بطاقتك.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-medium sm:col-span-2">
          رقم البطاقة *
          <input name="cardNumber" inputmode="numeric" placeholder="4242 4242 4242 4242" value={value("cardNumber")} class="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
          {#if error("cardNumber")}<span class="mt-1 block text-xs text-red-600">{error("cardNumber")}</span>{/if}
        </label>
        <label class="block text-sm font-medium">
          تاريخ الانتهاء (MM/YY) *
          <input name="cardExpiry" placeholder="08/28" value={value("cardExpiry")} class="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
          {#if error("cardExpiry")}<span class="mt-1 block text-xs text-red-600">{error("cardExpiry")}</span>{/if}
        </label>
        <label class="block text-sm font-medium">
          رمز الأمان (CVV) *
          <input name="cardCvc" inputmode="numeric" value={value("cardCvc")} class="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
          {#if error("cardCvc")}<span class="mt-1 block text-xs text-red-600">{error("cardCvc")}</span>{/if}
        </label>
      </div>
    </fieldset>

    <button type="submit" class="w-full rounded-full bg-honey-600 py-3 font-bold text-white transition hover:bg-honey-700">تأكيد الطلب</button>
  </form>

  <aside class="h-fit rounded-2xl border border-stone-200 bg-white p-5">
    <h2 class="text-lg font-bold">ملخص الطلب</h2>
    <ul class="mt-4 space-y-3">
      {#each data.items as item (item.productId)}
        <li class="flex justify-between gap-2 text-sm">
          <span class="line-clamp-1">{item.name} × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.price * item.quantity)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 space-y-1 border-t border-stone-200 pt-3 text-sm">
      <div class="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatEGP(data.totals.subtotal)}</dd></div>
      <div class="flex justify-between"><dt>الشحن</dt><dd>{data.totals.shipping === 0 ? "مجاني" : formatEGP(data.totals.shipping)}</dd></div>
      <div class="flex justify-between text-base font-extrabold"><dt>الإجمالي</dt><dd>{formatEGP(data.totals.total)}</dd></div>
    </dl>
    <p class="mt-4 text-xs text-stone-400">بإتمام الطلب أنت توافق على استلام طلبك خلال 2-4 أيام عمل.</p>
  </aside>
</div>