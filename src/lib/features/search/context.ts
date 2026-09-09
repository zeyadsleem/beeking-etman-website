import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { Lang } from "$lib/i18n/messages";
import type { DbRateLimiter } from "$lib/server/rate-limit";
import * as schema from "$lib/server/db/schema";

export interface SearchRpcContext {
  db: LibSQLDatabase<typeof schema>;
  rateLimiter: DbRateLimiter;
  clientAddress: string;
  lang: Lang;
}
