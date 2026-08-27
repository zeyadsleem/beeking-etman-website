import { estimateKvUsage, KV_MAX_STORAGE_BYTES } from "$lib/server/admin/upload";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (event.locals.user?.role !== "admin") {
    return { usage: null, lang: getLang(event) };
  }

  const mediaNs = event.platform?.env?.MEDIA;
  let usage = null;
  if (mediaNs) {
    try {
      usage = await estimateKvUsage(mediaNs);
    } catch {
      usage = null;
    }
  }

  return {
    usage,
    maxStorage: KV_MAX_STORAGE_BYTES,
    lang: getLang(event),
  };
};
