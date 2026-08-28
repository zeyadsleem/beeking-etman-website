<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import StoreBrowser from "$lib/components/StoreBrowser.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);
</script>

<Seo
  title={t(lang, "products.honeyPageTitle")}
  description={t(lang, "meta.store.honey")}
  path="/store/honey"
  siteName={t(lang, "brand.name")}
  noindex={Boolean(data.filters.q)}
/>

<section class="mt-8">
  <p class="eyebrow">{t(lang, "brand.name")}</p>
  <h1 class="headline mt-2 text-4xl leading-tight text-cocoa-900">{t(lang, "products.honeyTitle")}</h1>
  <p class="mt-3 max-w-xl text-cocoa-500">{t(lang, "products.honeySubtitle")}</p>
</section>

<Breadcrumb
  lang={lang}
  className="mt-8"
  items={[
    { label: t(lang, "nav.home"), href: "/" },
    { label: t(lang, "breadcrumb.honeyStore"), href: "/store/honey" },
  ]}
/>

<StoreBrowser data={data} department="honey" {lang} />
