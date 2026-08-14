<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const localized = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long", timeStyle: "short" });
</script>

<svelte:head><title>تأكيد الطلب — مملكة النحل</title></svelte:head>

<div class="mx-auto max-w-2xl pt-10 text-center motion-safe:animate-fade-up">
  <div class="relative mx-auto grid h-24 w-24 place-items-center">
    <svg class="absolute inset-0" viewBox="0 0 26 30" fill="none" aria-hidden="true">
      <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="#f3da99" stroke="#a35110" stroke-width="1.4" />
    </svg>
    <div class="grid h-12 w-12 place-items-center rounded-full bg-honey-500 text-2xl text-white shadow-warm">✓</div>
  </div>
  <h1 class="headline mt-5 text-4xl leading-tight text-cocoa-900">شكراً لك! تم استلام طلبك</h1>
  <p class="mt-3 text-lg text-cocoa-600">
    رقم الطلب <span class="badge-ok px-4 py-1 font-extrabold" data-testid="order-number">{data.order.number}</span>
  </p>
  <p class="mt-2 text-sm text-cocoa-400">الدفع تمت محاكاته — لا يوجد أي خصم فعلي على بطاقتك.</p>

  <section class="mt-8 rounded-[1.8rem] border border-cocoa-100 bg-parchment p-6 text-start shadow-warm">
    <h2 class="headline text-xl text-cocoa-900">المنتجات</h2>
    <ul class="mt-3 space-y-2 text-sm text-cocoa-700">
      {#each data.items as item (item.id)}
        <li class="flex justify-between gap-2">
          <span>{item.productName}{item.variantName ? ` (${item.variantName})` : ""} × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.unitPrice * item.quantity)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 flex justify-between border-t border-honey-200 pt-3 text-base font-extrabold text-cocoa-900">
      <dt>الإجمالي</dt>
      <dd>{formatEGP(data.order.total)}</dd>
    </dl>
  </section>

  <section class="mt-4 rounded-[1.8rem] border border-cocoa-100 bg-parchment p-6 text-start text-sm text-cocoa-600 shadow-warm">
    <p><span class="font-bold text-cocoa-900">التوصيل إلى:</span> {data.order.address}، {data.order.city}</p>
    <p><span class="font-bold text-cocoa-900">العميل:</span> {data.order.name} — {data.order.phone}</p>
    <p><span class="font-bold text-cocoa-900">التاريخ:</span> {localized.format(data.order.createdAt)}</p>
  </section>

  <a href="/products" class="btn-honey mt-8">مواصلة التسوق</a>
</div>