export const SQLITE_BUSY_RETRIES = 3;
export const SQLITE_BUSY_RETRY_DELAY_MS = 50;

export function isBusyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return code === "SQLITE_BUSY" || /database is locked/i.test(error.message);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
