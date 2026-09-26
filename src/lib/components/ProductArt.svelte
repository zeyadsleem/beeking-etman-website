<script lang="ts">
  import { ImageOff } from "@lucide/svelte";
  let { department = "honey", categorySlug = "", lang = "ar", class: className = "" }: { department?: string; categorySlug?: string; lang?: string; class?: string } = $props();
</script>
<div class={`flex h-full w-full flex-col items-center justify-center gap-3 border border-dashed border-cocoa-300 bg-cocoa-100 p-5 text-cocoa-500 ${className}`} data-department={department} data-category={categorySlug}>
  <ImageOff size={28} strokeWidth={1.3} aria-hidden="true" />
  <span class="text-xs">{lang === "ar" ? "صورة المنتج غير متاحة حاليًا" : "Product photo not yet available"}</span>
</div>
