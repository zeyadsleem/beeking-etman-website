<script lang="ts">
  import { Dialog } from "bits-ui";
  import Button from "$lib/components/Button.svelte";

  let {
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    busy = false,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    busy?: boolean;
    onConfirm: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay
      class="data-[state=open]:animate-fade-in fixed inset-0 z-40 bg-cocoa-950/40 backdrop-blur-sm"
    />
    <Dialog.Content
      class="data-[state=open]:animate-fade-up fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-lg"
    >
      <Dialog.Title class="headline text-lg text-cocoa-900">{title}</Dialog.Title>
      <Dialog.Description class="mt-2 text-sm leading-relaxed text-cocoa-600">
        {description}
      </Dialog.Description>
      <div class="mt-6 flex justify-end gap-3 ltr:flex-row rtl:flex-row-reverse">
        <Dialog.Close>
          <Button variant="outline" disabled={busy}>{cancelLabel}</Button>
        </Dialog.Close>
        <Button variant="primary" disabled={busy} onclick={onConfirm}>
          {busy ? "…" : confirmLabel}
        </Button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
