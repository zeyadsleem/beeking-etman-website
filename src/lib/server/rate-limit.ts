export interface RateLimiter {
  allow(key: string): boolean;
}

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const { windowMs, max } = options;
  const hits = new Map<string, number[]>();

  return {
    allow(key: string): boolean {
      const now = Date.now();
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

export function clientAddressKey(event: { getClientAddress(): string }): string {
  try {
    return event.getClientAddress();
  } catch {
    return "unknown";
  }
}
