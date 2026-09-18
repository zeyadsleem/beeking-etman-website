<script lang="ts">
  import {
    ADMIN_PAYMENT_STATUS_BADGE_CLASS,
    ADMIN_PAYMENT_STATUS_LABEL_KEY,
    type PaymentStatus,
  } from "$lib/settlement/types";
  import { t, type Lang } from "$lib/i18n/messages";

  let { status, lang }: { status: PaymentStatus; lang: Lang } = $props();
</script>

<span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold {ADMIN_PAYMENT_STATUS_BADGE_CLASS[status]}">
  {t(lang, ADMIN_PAYMENT_STATUS_LABEL_KEY[status])}
</span>
