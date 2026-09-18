export const SQLITE_BUSY_RETRIES = 3;
export const SQLITE_BUSY_RETRY_DELAY_MS = 50;

interface BatchWriteResult {
  rowsAffected?: number;
  meta?: { changes?: number };
}

/** Affected-row count for a libsql write or batch result. */
export function affectedRowCount(result: unknown): number {
  if (typeof result !== "object" || result === null) return 0;
  const { rowsAffected, meta } = result as BatchWriteResult;
  if (typeof rowsAffected === "number") return rowsAffected;
  return typeof meta?.changes === "number" ? meta.changes : 0;
}

export function isBusyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return code === "SQLITE_BUSY" || /database is locked/i.test(error.message);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryOnBusy<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isBusyError(error) || attempt >= SQLITE_BUSY_RETRIES) throw error;
      await sleep((attempt + 1) * SQLITE_BUSY_RETRY_DELAY_MS);
    }
  }
}
