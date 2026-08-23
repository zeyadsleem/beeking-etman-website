<script lang="ts">
  import FallbackBlends from "../../../routes/blends/FallbackBlends.svelte";
  import type { PageData } from "../../../routes/blends/$types";

  let { data }: { data: PageData } = $props();
</script>

<FallbackBlends {data} />
