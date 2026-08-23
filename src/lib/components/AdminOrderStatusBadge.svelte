<script lang="ts">
  import {
    ADMIN_ORDER_STATUS_BADGE_CLASS,
    ADMIN_ORDER_STATUS_LABEL_KEY,
  } from "$lib/admin-order-status";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { OrderStatus } from "$lib/server/admin/orders";

  let { status, lang }: { status: OrderStatus; lang: Lang } = $props();
</script>

<span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold {ADMIN_ORDER_STATUS_BADGE_CLASS[status]}">
  {t(lang, ADMIN_ORDER_STATUS_LABEL_KEY[status])}
</span>
