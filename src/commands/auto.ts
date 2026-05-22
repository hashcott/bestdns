import * as p from "@clack/prompts";
import type { ProviderGroup } from "../types";
import { runApply } from "./apply";
import { runBenchmark } from "./benchmark";

/** Options for the `auto` command. */
export interface AutoCommandOptions {
  /** Limit the benchmark to a category. */
  group?: ProviderGroup | "all";
  /** Also apply IPv6 addresses. */
  ipv6?: boolean;
  /** Skip the confirmation prompt before applying. */
  yes?: boolean;
  /** Allow interactive prompts. */
  interactive?: boolean;
}

/**
 * One-shot flow: benchmark every provider, then apply the fastest one to the
 * active network service.
 */
export async function runAuto(options: AutoCommandOptions = {}): Promise<void> {
  p.log.step("Step 1 of 2 — Benchmarking DNS providers");
  const results = await runBenchmark({
    group: options.group,
    interactive: options.interactive,
  });

  const winner = results.find((result) => !result.failed);
  if (!winner) {
    // runBenchmark already reported the failure.
    return;
  }

  p.log.step(`Step 2 of 2 — Applying the fastest provider (${winner.provider.name})`);
  await runApply({
    provider: winner.provider.id,
    ipv6: options.ipv6,
    yes: options.yes,
    interactive: options.interactive,
  });
}
