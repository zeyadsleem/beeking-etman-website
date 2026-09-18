<script lang="ts">
  import { scrollable } from "$lib/actions/scrollable";
  import { enhance } from "$app/forms";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import Button from "$lib/components/Button.svelte";
  import EmptyState from "$lib/components/admin/EmptyState.svelte";
  import { t, type Lang, type MessageKey } from "$lib/i18n/messages";
  import { formatDate } from "$lib/i18n/messages";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData | null } = $props();
  const lang = $derived<Lang>(data.lang);

  const STATUS_KEYS: Record<string, MessageKey> = {
    pending: "admin.transfers.status.pending",
    outbound: "admin.transfers.status.outbound",
    completed: "admin.transfers.status.completed",
    cancelled: "admin.transfers.status.cancelled",
  };
  const ITEMTYPE_KEYS: Record<string, MessageKey> = {
    variant: "admin.transfers.itemType.variant",
    batch: "admin.transfers.itemType.batch",
    material: "admin.transfers.itemType.material",
  };

  const NEXT_ACTIONS: Record<string, { next: "outbound" | "completed" | "cancelled"; labelKey: MessageKey }[]> = {
    pending: [
      { next: "outbound", labelKey: "admin.transfers.advance" },
      { next: "cancelled", labelKey: "admin.transfers.cancel" },
    ],
    outbound: [
      { next: "completed", labelKey: "admin.transfers.status.completed" },
      { next: "cancelled", labelKey: "admin.transfers.cancel" },
    ],
  };

  let fromWarehouseId = $state("");
  let toWarehouseId = $state("");
  let itemType = $state<"variant" | "batch" | "material">("variant");
  let itemId = $state("");
  let quantity = $state("");

  function resetCreate(): void {
    fromWarehouseId = "";
    toWarehouseId = "";
    itemType = "variant";
    itemId = "";
    quantity = "";
  }
</script>

<svelte:head>
  <title>{t(lang, "admin.transfers.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.transfers.title")}</SectionTitle>
  <p class="mt-2 text-cocoa-500">{t(lang, "admin.transfers.description")}</p>

  {#if data.warehouses.length >= 2}
    <form
      method="POST"
      action="?/create"
      use:enhance={() => {
        return ({ update }) => {
          update();
        };
      }}
      class="mt-8 max-w-3xl border border-cocoa-100 rounded-2xl bg-parchment p-5 shadow-warm-sm"
    >
      <h2 class="text-lg font-semibold text-cocoa-800">{t(lang, "admin.transfers.new")}</h2>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm text-cocoa-600">
          <span>{t(lang, "admin.transfers.from")}</span>
          <select
            name="fromWarehouseId"
            value={fromWarehouseId}
            onchange={(e) => (fromWarehouseId = (e.currentTarget as HTMLSelectElement).value)}
            class="rounded-lg border border-cocoa-200 bg-white px-3 py-2 text-cocoa-800"
          >
            {#each data.warehouses as w}
              <option value={w.id}>{w.nameEn}</option>
            {/each}
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm text-cocoa-600">
          <span>{t(lang, "admin.transfers.to")}</span>
          <select
            name="toWarehouseId"
            value={toWarehouseId}
            onchange={(e) => (toWarehouseId = (e.currentTarget as HTMLSelectElement).value)}
            class="rounded-lg border border-cocoa-200 bg-white px-3 py-2 text-cocoa-800"
          >
            {#each data.warehouses as w}
              <option value={w.id}>{w.nameEn}</option>
            {/each}
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm text-cocoa-600">
          <span>{t(lang, "admin.transfers.itemType")}</span>
          <select
            name="itemType"
            value={itemType}
            onchange={(e) => (itemType = (e.currentTarget as HTMLSelectElement).value as typeof itemType)}
            class="rounded-lg border border-cocoa-200 bg-white px-3 py-2 text-cocoa-800"
          >
            <option value="variant">{t(lang, "admin.transfers.itemType.variant")}</option>
            <option value="batch">{t(lang, "admin.transfers.itemType.batch")}</option>
            <option value="material">{t(lang, "admin.transfers.itemType.material")}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm text-cocoa-600">
          <span>ID</span>
          <input
            name="itemId"
            value={itemId}
            oninput={(e) => (itemId = (e.currentTarget as HTMLInputElement).value)}
            class="rounded-lg border border-cocoa-200 bg-white px-3 py-2 text-cocoa-800"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-cocoa-600">
          <span>{t(lang, "admin.transfers.quantity")}</span>
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            oninput={(e) => (quantity = (e.currentTarget as HTMLInputElement).value)}
            class="rounded-lg border border-cocoa-200 bg-white px-3 py-2 text-cocoa-800"
          />
        </label>
      </div>
      {#if form && !form.ok && form.message}
        <p class="mt-3 text-sm text-clay-600" role="alert">{form.message}</p>
      {/if}
      <div class="mt-4 flex items-center gap-3">
        <Button type="submit">{t(lang, "admin.transfers.create")}</Button>
        <button type="button" onclick={resetCreate} class="text-sm text-cocoa-500 hover:underline">
          {t(lang, "admin.transfers.cancel")}
        </button>
      </div>
    </form>
  {/if}

  <div class="mt-8">
    {#if data.items.length === 0}
      <EmptyState title={t(lang, "admin.transfers.empty")} />
    {:else}
      <div role="region" use:scrollable aria-label={t(lang, "admin.transfers.title")} class="overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
        <table class="w-full min-w-max text-sm" data-testid="admin-transfers-table">
          <thead>
            <tr class="border-b border-cocoa-100 text-xs uppercase text-cocoa-500">
              <th class="px-4 py-3 text-start">{t(lang, "admin.transfers.from")}</th>
              <th class="px-4 py-3 text-start">{t(lang, "admin.transfers.to")}</th>
              <th class="px-4 py-3 text-start">{t(lang, "admin.transfers.status")}</th>
              <th class="px-4 py-3 text-start">{t(lang, "admin.transfers.items")}</th>
              <th class="px-4 py-3 text-start">{t(lang, "admin.transfers.createdAt")}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-cocoa-100">
            {#each data.items as transfer (transfer.id)}
              <tr class="hover:bg-white" data-testid="admin-transfer-row">
                <td class="px-4 py-3 font-medium text-cocoa-800">{transfer.fromWarehouse}</td>
                <td class="px-4 py-3 font-medium text-cocoa-800">{transfer.toWarehouse}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full bg-cocoa-100 px-2.5 py-0.5 text-xs text-cocoa-700">
                    {t(lang, STATUS_KEYS[transfer.status] ?? "admin.transfers.status.pending")}
                  </span>
                </td>
                <td class="px-4 py-3 text-cocoa-600">
                  {#if transfer.items.length === 0}
                    —
                  {:else}
                    <ul class="space-y-0.5">
                      {#each transfer.items as it (transfer.id + it.itemType + it.itemId)}
                        <li>
                          {t(lang, ITEMTYPE_KEYS[it.itemType] ?? "admin.transfers.itemType.variant")} ·
                          {it.quantity}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </td>
                <td class="px-4 py-3 text-cocoa-600">{formatDate(lang, transfer.createdAt)}</td>
                <td class="px-4 py-3 text-end">
                  {#if NEXT_ACTIONS[transfer.status]}
                    <div class="flex justify-end gap-2">
                      {#each NEXT_ACTIONS[transfer.status] as action (transfer.id + action.next)}
                        <form method="POST" action="?/advance" use:enhance>
                          <input type="hidden" name="transferId" value={transfer.id} />
                          <input type="hidden" name="next" value={action.next} />
                          <Button variant={action.next === "cancelled" ? "ghost" : "outline"} type="submit">
                            {t(lang, action.labelKey)}
                          </Button>
                        </form>
                      {/each}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
