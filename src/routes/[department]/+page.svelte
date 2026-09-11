<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import PageHero from "$lib/components/PageHero.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import StoreBrowser from "$lib/components/StoreBrowser.svelte";
  import { t } from "$lib/i18n/messages";
  import type { Lang } from "$lib/i18n/messages";
  import type { Department } from "$lib/server/store";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang: Lang = $derived(data.lang);
  const department: Department = $derived(data.department);
  const isHoney = $derived(department === "honey");

  const deptPath = $derived(`/${department}`);
  const pageTitle = $derived(
    isHoney ? t(lang, "products.honeyPageTitle") : t(lang, "products.equipmentPageTitle"),
  );
  const metaKey = $derived(isHoney ? "honey" : "equipment");
  const title = $derived(
    isHoney ? t(lang, "products.honeyTitle") : t(lang, "products.equipmentTitle"),
  );
  const subtitle = $derived(
    isHoney ? t(lang, "products.honeySubtitle") : t(lang, "products.equipmentSubtitle"),
  );
  const crumb = $derived(
    isHoney ? t(lang, "breadcrumb.honeyStore") : t(lang, "breadcrumb.equipmentStore"),
  );
</script>

<Seo
  title={pageTitle}
  description={t(lang, `meta.store.${metaKey}`)}
  path={deptPath}
  siteName={t(lang, "brand.name")}
  noindex={Boolean(data.filters.q)}
/>

<Breadcrumb
  lang={lang}
  className="mt-8"
  items={[
    { label: t(lang, "nav.home"), href: "/" },
    { label: crumb, href: deptPath },
  ]}
/>

<PageHero eyebrow={t(lang, "brand.name")} {title} {subtitle} class="mt-5" />

<StoreBrowser data={data} department={department} {lang} />
