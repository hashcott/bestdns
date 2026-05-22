/** Small, dependency-free helpers shared across the codebase. */

/** True when `value` is a syntactically valid IPv4 address. */
export function isIpv4(value: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value.trim());
  if (!match) return false;
  return match.slice(1, 5).every((octet) => Number(octet) <= 255);
}

/** True when `value` looks like a valid IPv6 address (loose but practical). */
export function isIpv6(value: string): boolean {
  const v = value.trim();
  return v.length >= 2 && v.includes(":") && /^[0-9a-fA-F:.%]+$/.test(v);
}

/** True when `value` is usable as a DNS server address. */
export function isDnsServer(value: string): boolean {
  return isIpv4(value) || isIpv6(value);
}

/** Arithmetic mean of a list of numbers (0 when empty). */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/** Population standard deviation — used to express latency jitter. */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((n) => (n - m) ** 2)));
}

/** Run `worker` over `items` with at most `limit` tasks in flight at once. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function runner(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T, index);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(runners);
  return results;
}

/** Promise that resolves after `ms` milliseconds. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** A random label guaranteed not to exist in DNS — for cold-cache tests. */
export function randomLabel(): string {
  return `bestdns-${Math.random().toString(36).slice(2, 12)}`;
}
