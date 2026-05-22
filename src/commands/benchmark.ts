import * as p from "@clack/prompts";
import pc from "picocolors";
import { getAllProviders, getProvidersByGroup } from "../catalog";
import { type BenchmarkResult, benchmarkProviders } from "../core/benchmark";
import { loadConfig, saveConfig } from "../store/config";
import type { ProviderGroup } from "../types";
import { promptGroup } from "../ui/prompts";
import { renderBenchmarkTable } from "../ui/render";
import { icons } from "../ui/theme";

/** Options for the `benchmark` command. */
export interface BenchmarkCommandOptions {
  /** Limit to a category, or "all" (default). */
  group?: ProviderGroup | "all";
  /** Measured rounds per provider. */
  rounds?: number;
  /** Show only the fastest N results. */
  top?: number;
  /** Emit machine-readable JSON instead of a table. */
  json?: boolean;
  /** Allow interactive prompts for missing input. */
  interactive?: boolean;
}

/** Shape a benchmark result for JSON output. */
function toJson(result: BenchmarkResult) {
  return {
    id: result.provider.id,
    name: result.provider.name,
    group: result.provider.group,
    server: result.server,
    avgMs: Number(result.avgMs.toFixed(2)),
    minMs: Number(result.minMs.toFixed(2)),
    jitterMs: Number(result.jitterMs.toFixed(2)),
    reliability: Number(result.reliability.toFixed(4)),
    score: Number(result.score.toFixed(2)),
    failed: result.failed,
  };
}

/**
 * Benchmark DNS providers and present a fastest-first leaderboard.
 * Returns the sorted results so callers (e.g. `auto`) can reuse them.
 */
export async function runBenchmark(
  options: BenchmarkCommandOptions = {},
): Promise<BenchmarkResult[]> {
  let group = options.group;
  if (!group && options.interactive) group = await promptGroup(true);
  group ??= "all";

  const providers = group === "all" ? getAllProviders() : getProvidersByGroup(group);
  if (providers.length === 0) {
    p.log.warn("There are no providers to benchmark in this category.");
    return [];
  }

  const rounds = options.rounds && options.rounds > 0 ? options.rounds : 5;

  // JSON mode: no spinner, no decoration.
  if (options.json) {
    const results = await benchmarkProviders(providers, { rounds });
    process.stdout.write(`${JSON.stringify(results.map(toJson), null, 2)}\n`);
    return results;
  }

  const spin = p.spinner();
  spin.start(`Benchmarking ${providers.length} DNS providers…`);
  const results = await benchmarkProviders(providers, {
    rounds,
    onProgress: (done, total, provider) => {
      spin.message(`Benchmarking ${done}/${total} — ${provider.name}`);
    },
  });
  spin.stop(`Benchmarked ${providers.length} providers over ${rounds} rounds.`);

  const shown = options.top && options.top > 0 ? results.slice(0, options.top) : results;
  process.stdout.write(`\n${renderBenchmarkTable(shown)}\n\n`);

  const winner = results.find((result) => !result.failed);
  if (winner) {
    p.log.success(
      `${icons.star} Fastest: ${pc.bold(winner.provider.name)} ` +
        `— ${winner.avgMs.toFixed(1)} ms average, ${Math.round(winner.reliability * 100)}% reliable`,
    );
    p.log.message(pc.dim(`Apply it with:  bestdns apply ${winner.provider.id}`));

    const config = loadConfig();
    config.lastBenchmark = {
      at: new Date().toISOString(),
      bestId: winner.provider.id,
      bestName: winner.provider.name,
      avgMs: Number(winner.avgMs.toFixed(2)),
    };
    saveConfig(config);
  } else {
    p.log.error("No provider responded — check your internet connection and try again.");
  }

  return results;
}
