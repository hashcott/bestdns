import { pool } from "../../util";
import { ping } from "./ping";
import type { LatencyResult } from "./types";

/** Targets used to fingerprint general internet latency. */
export const DEFAULT_TARGETS = ["1.1.1.1", "8.8.8.8", "github.com"];

/** Ping every target concurrently and return one `LatencyResult` each. */
export async function measureLatency(
  targets: string[] = DEFAULT_TARGETS,
  count = 4,
): Promise<LatencyResult[]> {
  return pool(targets, 3, async (target) => ({
    target,
    ping: await ping(target, count, { timeoutMs: count * 2000 + 4000 }),
  }));
}

/** Average of the per-target average latencies that successfully responded. */
export function meanLatency(results: LatencyResult[]): number | null {
  const values = results
    .map((result) => result.ping.avgMs)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, ms) => sum + ms, 0) / values.length;
}
