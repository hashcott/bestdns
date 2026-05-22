import type { DnsProvider } from "../types";
import { mean, pool, randomLabel, stddev } from "../util";
import { timedQuery } from "./resolver";

/** Popular domains used to measure warm-cache resolution latency. */
const TEST_DOMAINS = [
  "google.com",
  "youtube.com",
  "wikipedia.org",
  "github.com",
  "amazon.com",
  "cloudflare.com",
];

/** Aggregated benchmark result for one provider. */
export interface BenchmarkResult {
  provider: DnsProvider;
  /** Address that was tested (the provider's primary IPv4). */
  server: string;
  /** Mean latency of the responding queries, in milliseconds. */
  avgMs: number;
  /** Fastest single query, in milliseconds. */
  minMs: number;
  /** Latency standard deviation — lower is steadier. */
  jitterMs: number;
  /** Share of queries the server answered, 0..1. */
  reliability: number;
  /** Number of queries that produced a usable timing sample. */
  samples: number;
  /** Total queries attempted. */
  attempts: number;
  /** Composite score — lower is better. */
  score: number;
  /** True when the server did not answer a single query. */
  failed: boolean;
}

/** Options controlling a benchmark run. */
export interface BenchmarkOptions {
  /** Measured rounds per provider (default 5). */
  rounds?: number;
  /** Maximum providers tested in parallel (default 8). */
  concurrency?: number;
  /** Per-query timeout in milliseconds (default 2500). */
  timeoutMs?: number;
  /** Progress callback, invoked once per finished provider. */
  onProgress?: (completed: number, total: number, provider: DnsProvider) => void;
}

/** Composite score — latency, with penalties for jitter and unreliability. */
function scoreOf(avgMs: number, jitterMs: number, reliability: number): number {
  return avgMs + jitterMs * 0.4 + (1 - reliability) * 3000;
}

/** Benchmark a single provider by repeatedly resolving the test domains. */
export async function benchmarkProvider(
  provider: DnsProvider,
  rounds: number,
  timeoutMs: number,
): Promise<BenchmarkResult> {
  const server = provider.ipv4[0];
  const base: Omit<BenchmarkResult, "provider" | "server"> = {
    avgMs: 0,
    minMs: 0,
    jitterMs: 0,
    reliability: 0,
    samples: 0,
    attempts: 0,
    score: scoreOf(0, 0, 0),
    failed: true,
  };
  if (!server) {
    return { provider, server: "", ...base };
  }

  // Warm-up query (discarded) so connection setup doesn't skew the first round.
  await timedQuery(server, "example.com", "A", timeoutMs);

  const latencies: number[] = [];
  let attempts = 0;

  for (let round = 0; round < rounds; round++) {
    for (const domain of TEST_DOMAINS) {
      attempts++;
      const outcome = await timedQuery(server, domain, "A", timeoutMs);
      if (outcome.responded) latencies.push(outcome.ms);
    }
    // One guaranteed cache-miss to measure cold-lookup performance.
    attempts++;
    const cold = await timedQuery(server, `${randomLabel()}.com`, "A", timeoutMs);
    if (cold.responded) latencies.push(cold.ms);
  }

  const reliability = attempts > 0 ? latencies.length / attempts : 0;
  const avgMs = mean(latencies);
  const jitterMs = stddev(latencies);
  const minMs = latencies.length > 0 ? Math.min(...latencies) : 0;

  return {
    provider,
    server,
    avgMs,
    minMs,
    jitterMs,
    reliability,
    samples: latencies.length,
    attempts,
    score: scoreOf(avgMs, jitterMs, reliability),
    failed: latencies.length === 0,
  };
}

/**
 * Benchmark a list of providers in parallel and return the results sorted
 * fastest-first.
 */
export async function benchmarkProviders(
  providers: DnsProvider[],
  options: BenchmarkOptions = {},
): Promise<BenchmarkResult[]> {
  const rounds = options.rounds ?? 5;
  const timeoutMs = options.timeoutMs ?? 2500;
  const concurrency = options.concurrency ?? 8;

  let completed = 0;
  const results = await pool(providers, concurrency, async (provider) => {
    const result = await benchmarkProvider(provider, rounds, timeoutMs);
    completed++;
    options.onProgress?.(completed, providers.length, provider);
    return result;
  });

  return results.sort((a, b) => a.score - b.score);
}
