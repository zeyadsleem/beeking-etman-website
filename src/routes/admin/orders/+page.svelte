<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import AdminOrderStatusBadge from "$lib/components/AdminOrderStatusBadge.svelte";
  import AdminPaymentStatusBadge from "$lib/components/AdminPaymentStatusBadge.svelte";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import {
    ADMIN_ORDER_STATUS_LABEL_KEY,
    ADMIN_PAYMENT_METHOD_LABEL_KEY,
    ADMIN_PAYMENT_STATUS_LABEL_KEY,
    PAYMENT_STATUSES,
    STATUS_ORDER,
    type PaymentStatus,
  } from "$lib/settlement/types";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { OrderStatus } from "$lib/server/admin/orders";
  import type { PageData } from "./$types";

  let { data }: {
    data: Pick<
      PageData,
      "items" | "total" | "page" | "pageSize" | "status" | "payment" | "q" | "lang"
    >;
  } = $props();
  const lang = $derived(data.lang);

  // Every filter link keeps the other active dimension and flips only its own,
  // so the status and payment navs compose instead of resetting each other.
  function filterHref(opts: {
    status?: OrderStatus | null;
    payment?: PaymentStatus | null;
    page?: number;
  }): string {
    const params = new URLSearchParams();
    if (data.q) params.set("q", data.q);
    if (opts.status) params.set("status", opts.status);
    if (opts.payment) params.set("payment", opts.payment);
    if (opts.page && opts.page > 1) params.set("page", String(opts.page));
    const query = params.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  }

  const hasNextPage = $derived(data.page * data.pageSize < data.total);
</script>

<svelte:head>
  <title>{t(lang, "admin.orders.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.orders.title")}</SectionTitle>

  <div class="mt-4 flex flex-wrap items-center gap-3">
    <Button variant="ghost" href="/admin/orders/export" class="text-sm">
      {t(lang, "admin.orders.exportCsv")}
    </Button>
    <Button
      variant="outline"
      href={filterHref({ status: data.status, payment: "pending_review" })}
      class="text-sm"
      data-testid="review-queue-shortcut"
    >
      {t(lang, "admin.orders.reviewQueue")}
    </Button>
  </div>

  <nav class="mt-6 flex flex-wrap gap-2" aria-label={t(lang, "admin.orders.filterAria")}>
    <a
      href={filterHref({ payment: data.payment })}
      class="chip {data.status === null ? 'chip-active' : ''}"
      aria-current={data.status === null ? "true" : undefined}
    >
      {t(lang, "admin.orders.all")}
    </a>
    {#each STATUS_ORDER as status (status)}
      <a
        href={filterHref({ status, payment: data.payment })}
        class="chip {data.status === status ? 'chip-active' : ''}"
        aria-current={data.status === status ? "true" : undefined}
      >
        {t(lang, ADMIN_ORDER_STATUS_LABEL_KEY[status])}
      </a>
    {/each}
  </nav>

  <nav class="mt-3 flex flex-wrap gap-2" aria-label={t(lang, "admin.orders.paymentFilter")}>
    <a
      href={filterHref({ status: data.status })}
      class="chip {data.payment === null ? 'chip-active' : ''}"
      aria-current={data.payment === null ? "true" : undefined}
    >
      {t(lang, "admin.orders.all")}
    </a>
    {#each PAYMENT_STATUSES as payment (payment)}
      <a
        href={filterHref({ status: data.status, payment })}
        class="chip {data.payment === payment ? 'chip-active' : ''}"
        aria-current={data.payment === payment ? "true" : undefined}
      >
        {t(lang, ADMIN_PAYMENT_STATUS_LABEL_KEY[payment])}
      </a>
    {/each}
  </nav>

  <form
    method="GET"
    action="/admin/orders"
    role="search"
    class="mt-6 flex max-w-md items-center gap-2"
  >
    {#if data.status}<input type="hidden" name="status" value={data.status} />{/if}
    {#if data.payment}<input type="hidden" name="payment" value={data.payment} />{/if}
    <input
      type="search"
      name="q"
      value={data.q}
      placeholder={t(lang, "admin.orders.searchPlaceholder")}
      aria-label={t(lang, "admin.orders.searchPlaceholder")}
      class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
    />
    <Button type="submit" variant="outline">{t(lang, "products.searchSubmit")}</Button>
  </form>

  <p class="mt-4 text-sm text-cocoa-500" role="status">
    {t(lang, "admin.searchResultCount", { count: String(data.total) })}
  </p>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "admin.orders.empty")}</p>
    </div>
  {:else}
    <ul class="mt-8 space-y-4">
      {#each data.items as order (order.id)}
        <li>
          <a
            href={`/admin/orders/${order.id}`}
            class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm transition hover:border-cocoa-200"
            data-testid="admin-order-row"
          >
            <div>
              <p class="card-title text-lg text-honey-700">{order.number}</p>
              <p class="mt-0.5 text-sm text-cocoa-500">{formatDate(lang, order.createdAt)}</p>
            </div>
            <div class="text-sm">
              <span class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.orders.customer")}</span>
              <p class="mt-1 font-medium text-cocoa-800">{order.name}</p>
              <p class="text-cocoa-600">{order.phone} · {order.city}</p>
            </div>
            <AdminOrderStatusBadge status={order.status} {lang} />
            <div class="text-sm">
              <span class="block text-xs font-semibold text-cocoa-400">{t(lang, "admin.orders.paymentColumn")}</span>
              <p class="mt-1 font-medium text-cocoa-800">
                {order.paymentMethod ? t(lang, ADMIN_PAYMENT_METHOD_LABEL_KEY[order.paymentMethod]) : "—"}
              </p>
              {#if order.paymentStatus}
                <div class="mt-1">
                  <AdminPaymentStatusBadge status={order.paymentStatus} {lang} />
                </div>
              {/if}
            </div>
            <div class="text-end">
              <span class="block text-xs font-semibold text-cocoa-400">{t(lang, "admin.orders.total")}</span>
              <span class="font-extrabold text-cocoa-900">{formatEGP(order.total, lang)}</span>
            </div>
          </a>
        </li>
      {/each}
    </ul>

    {#if data.page > 1 || hasNextPage}
      <nav class="mt-10 flex items-center justify-center gap-4" aria-label={t(lang, "products.paginationAria")}>
        {#if data.page > 1}
          <a
            href={filterHref({ status: data.status, payment: data.payment, page: data.page - 1 })}
            class="btn-outline text-sm"
          >
            {t(lang, "admin.orders.prev")}
          </a>
        {/if}
        {#if hasNextPage}
          <a
            href={filterHref({ status: data.status, payment: data.payment, page: data.page + 1 })}
            class="btn-outline text-sm"
          >
            {t(lang, "admin.orders.next")}
          </a>
        {/if}
      </nav>
    {/if}
  {/if}
</section>
