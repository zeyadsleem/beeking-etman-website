import { loadStorePage } from "$lib/server/store-page";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => loadStorePage(event, "honey");
