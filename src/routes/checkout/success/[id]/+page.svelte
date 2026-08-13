<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const localized = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long", timeStyle: "short" });
</script>

<svelte:head><title>تأكيد الطلب — بيت العسل</title></svelte:head>

<div class="mx-auto max-w-2xl pt-10 text-center">
  <div class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-100 text-3xl text-green-700">✓</div>
  <h1 class="mt-4 text-3xl font-extrabold">شكراً لك! تم استلام طلبك</h1>
  <p class="mt-2 text-stone-500">رقم الطلب <span class="font-bold text-honey-800" data-testid="order-number">{data.order.number}</span></p>
  <p class="mt-1 text-sm text-stone-400">الدفع تمت محاكاته — لا يوجد أي خصم فعلي على بطاقتك.</p>

  <section class="mt-8 rounded-3xl border border-stone-200 bg-white p-6 text-start">
    <h2 class="text-lg font-bold">المنتجات</h2>
    <ul class="mt-3 space-y-2 text-sm">
      {#each data.items as item (item.id)}
        <li class="flex justify-between gap-2">
          <span>{item.productName} × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.unitPrice * item.quantity)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 flex justify-between border-t border-stone-200 pt-3 text-base font-extrabold">
      <dt>الإجمالي</dt>
      <dd>{formatEGP(data.order.total)}</dd>
    </dl>
  </section>

  <section class="mt-4 rounded-3xl border border-stone-200 bg-white p-6 text-start text-sm text-stone-600">
    <p><span class="font-bold">التوصيل إلى:</span> {data.order.address}، {data.order.city}</p>
    <p>العميل: {data.order.name} — {data.order.phone}</p>
    <p>التاريخ: {localized.format(data.order.createdAt)}</p>
  </section>

  <a href="/products" class="mt-8 inline-block rounded-full bg-honey-600 px-6 py-3 font-bold text-white hover:bg-honey-700">مواصلة التسوق</a>
</div>