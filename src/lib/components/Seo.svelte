<script lang="ts">
  import { canonicalUrl } from "$lib/site";
  import type { JsonLdObject } from "$lib/seo";

  let {
    title,
    description,
    path,
    siteName,
    image = "/images/logo.png",
    noindex = false,
    ogType = "website",
    jsonLd = [],
  }: {
    title: string;
    description: string;
    /** Site-absolute pathname (canonical strips query strings). */
    path: string;
    /** Localized brand name for og:site_name (t(lang, "brand.name")). */
    siteName?: string;
    image?: string;
    noindex?: boolean;
    ogType?: "website" | "product";
    jsonLd?: JsonLdObject[];
  } = $props();

  const canonical = $derived(canonicalUrl(path));
  const absoluteImage = $derived(image.startsWith("http") ? image : canonicalUrl(image));
  // JSON-LD payloads are injected as raw text; escaping "<" keeps a crafted
  // product name from closing the script tag early.
  const jsonLdBlobs = $derived(
    jsonLd.map((obj) => JSON.stringify(obj).replaceAll("<", "\\u003c")),
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
  {#if siteName}
    <meta property="og:site_name" content={siteName} />
  {/if}
  <meta property="og:type" content={ogType} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={absoluteImage} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={absoluteImage} />
  {#each jsonLdBlobs as blob (blob)}
    <script type="application/ld+json">{blob}</script>
  {/each}
</svelte:head>
