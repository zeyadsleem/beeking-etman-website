<script lang="ts">
  import { enhance } from "$app/forms";
  import { clearCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let submitting = $state(false);

  function value(name: string) {
    return form?.values ? String(form.values[name] ?? "") : "";
  }
  function error(name: string) {
    return form?.errors?.[name] ?? "";
  }
</script>

<svelte:head><title>إتمام الشراء — بيت العسل</title></svelte:head>

<div class="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
  <form
    method="post"
    action="?/submit"
    use:enhance={() => {
      submitting = true;
      return async ({ result, update }) => {
        if (result.type === "redirect") clearCart();
        submitting = false;
        update();
      };
    }}
    class="space-y-5 rounded-[1.8rem] border border-cocoa-100 bg-parchment p-6 shadow-warm sm:p-8"
  >
    <h1 class="rule-flourish headline text-3xl text-cocoa-900">
      <i aria-hidden="true"></i>
      معلومات التوصيل
    </h1>

    {#if error("cart")}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert" data-testid="cart-error">{error("cart")}</p>
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="field-label">
        الاسم بالكامل *
        <input name="name" value={value("name")} autocomplete="name" class="field mt-1" />
        {#if error("name")}<span class="field-error">{error("name")}</span>{/if}
      </label>
      <label class="field-label">
        البريد الإلكتروني *
        <input name="email" type="email" value={value("email")} autocomplete="email" class="field mt-1" />
        {#if error("email")}<span class="field-error">{error("email")}</span>{/if}
      </label>
      <label class="field-label">
        رقم الهاتف *
        <input name="phone" inputmode="tel" value={value("phone")} autocomplete="tel" class="field mt-1" />
        {#if error("phone")}<span class="field-error">{error("phone")}</span>{/if}
      </label>
      <label class="field-label">
        المدينة *
        <input name="city" value={value("city")} class="field mt-1" />
        {#if error("city")}<span class="field-error">{error("city")}</span>{/if}
      </label>
    </div>
    <label class="field-label">
      العنوان بالتفصيل *
      <input name="address" value={value("address")} autocomplete="street-address" class="field mt-1" />
      {#if error("address")}<span class="field-error">{error("address")}</span>{/if}
    </label>

    <fieldset class="honeycomb-bg rounded-2xl border border-honey-200 bg-honey-50/60 p-5">
      <legend class="px-2 text-sm font-bold text-cocoa-800">الدفع</legend>
      <p class="mb-4 text-xs text-cocoa-500">مرحلة تجريبية — لن تُخصم أي مبالغ من بطاقتك.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="field-label sm:col-span-2">
          رقم البطاقة *
          <input name="cardNumber" inputmode="numeric" placeholder="4242 4242 4242 4242" value={value("cardNumber")} autocomplete="cc-number" class="field mt-1 bg-white" />
          {#if error("cardNumber")}<span class="field-error">{error("cardNumber")}</span>{/if}
        </label>
        <label class="field-label">
          تاريخ الانتهاء (MM/YY) *
          <input name="cardExpiry" placeholder="08/28" value={value("cardExpiry")} autocomplete="cc-exp" class="field mt-1 bg-white" />
          {#if error("cardExpiry")}<span class="field-error">{error("cardExpiry")}</span>{/if}
        </label>
        <label class="field-label">
          رمز الأمان (CVV) *
          <input name="cardCvc" inputmode="numeric" value={value("cardCvc")} autocomplete="cc-csc" class="field mt-1 bg-white" />
          {#if error("cardCvc")}<span class="field-error">{error("cardCvc")}</span>{/if}
        </label>
      </div>
    </fieldset>

    <button
      type="submit"
      disabled={submitting}
      aria-busy={submitting}
      class="btn-honey w-full"
    >{submitting ? "جاري التأكيد…" : "تأكيد الطلب"}</button>
  </form>

  <aside class="h-fit rounded-2xl border border-honey-200 bg-gradient-to-b from-parchment to-honey-50 p-5 shadow-warm">
    <h2 class="headline text-xl text-cocoa-900">ملخص الطلب</h2>
    <ul class="mt-4 space-y-3">
      {#each data.items as item (item.variantId)}
        <li class="flex justify-between gap-2 text-sm text-cocoa-700">
          <span class="line-clamp-1">{item.name} ({item.variantName}) × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.price * item.quantity)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 space-y-1 border-t border-honey-200 pt-3 text-sm text-cocoa-700">
      <div class="flex justify-between"><dt>المجموع الفرعي</dt><dd class="font-semibold">{formatEGP(data.totals.subtotal)}</dd></div>
      <div class="flex justify-between"><dt>الشحن</dt><dd class="font-semibold">{data.totals.shipping === 0 ? "مجاني ✓" : formatEGP(data.totals.shipping)}</dd></div>
      <div class="flex justify-between text-base font-extrabold text-cocoa-900"><dt>الإجمالي</dt><dd>{formatEGP(data.totals.total)}</dd></div>
    </dl>
    <p class="mt-4 text-xs text-cocoa-400">بإتمام الطلب أنت توافق على استلام طلبك خلال 2-4 أيام عمل.</p>
  </aside>
</div>