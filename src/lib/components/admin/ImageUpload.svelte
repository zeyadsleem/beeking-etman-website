<script lang="ts">
  import { t, type Lang } from "$lib/i18n/messages";

  type UploadError = "too_large" | "unsupported" | null;

  let {
    lang,
    name = "image",
    initialUrl = "",
    label,
    required = false,
  }: {
    lang: Lang;
    /** `name` of the hidden file input so the surrounding multipart form picks it up. */
    name?: string;
    /** Existing image URL shown as the initial preview (edit case). */
    initialUrl?: string;
    label?: string;
    required?: boolean;
  } = $props();

  // svelte-ignore state_referenced_locally — seeding the preview once is the point.
  let previewUrl = $state(initialUrl ?? "");
  let dragActive = $state(false);
  let error: UploadError = $state(null);
  let fileInput: HTMLInputElement | undefined = $state();

  function selectFile(file: File | undefined) {
    if (!file) return;
    const problem = validate(file);
    error = problem;
    if (problem) return;
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
  }

  function validate(file: File): UploadError {
    if (file.size > 5 * 1024 * 1024) return "too_large";
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "unsupported";
    return null;
  }

  function onInput() {
    selectFile(fileInput?.files?.[0]);
  }

  function onDrop(event: DragEvent) {
    dragActive = false;
    selectFile(event.dataTransfer?.files?.[0]);
  }

  function browse() {
    fileInput?.click();
  }

  // Revoke any object URL on teardown.
  $effect(() => {
    const url = previewUrl;
    if (url && url.startsWith("blob:")) return () => URL.revokeObjectURL(url);
  });

  const errorMessage = $derived(
    error === "too_large"
      ? t(lang, "errors.uploadTooLarge")
      : error === "unsupported"
        ? t(lang, "errors.uploadUnsupported")
        : "",
  );
</script>

<div class="field-label">
  {#if label}
    <span>{label}</span>
  {/if}

  {#if previewUrl}
    <img
      src={previewUrl}
      alt=""
      class="mt-2 h-24 w-24 rounded-xl object-cover"
      data-testid="image-preview"
    />
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    role="button"
    tabindex="0"
    class="mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-cocoa-200 bg-white px-4 py-6 text-center transition-colors"
    class:border-honey-500={dragActive}
    ondragover={(e) => {
      e.preventDefault();
      dragActive = true;
    }}
    ondragleave={() => {
      dragActive = false;
    }}
    ondrop={(e) => {
      e.preventDefault();
      onDrop(e);
    }}
    onclick={browse}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        browse();
      }
    }}
  >
    <span class="text-sm font-semibold text-cocoa-700">{t(lang, "admin.products.imageFile")}</span>
    <span class="text-xs text-cocoa-400">{t(lang, "admin.products.dropOrPaste")}</span>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    {name}
    accept="image/jpeg,image/png,image/webp"
    {required}
    class="sr-only"
    data-testid="image-input"
    onchange={onInput}
  />

  {#if errorMessage}
    <span class="mt-1 block text-xs font-semibold text-red-700" role="alert">{errorMessage}</span>
  {/if}
</div>
