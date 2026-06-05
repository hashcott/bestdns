import * as p from "@clack/prompts";
import pc from "picocolors";
import { diagnose, pingAvailable, takeSnapshot } from "../core/network/diagnose";
import type { DiagnoseReport, Finding, FixId, NetworkSnapshot } from "../core/network/types";
import { flushDnsCache, restartMdns } from "../os/netops";
import { renderComparison, renderFindings, renderSnapshot } from "../ui/findings";
import { guard } from "../ui/prompts";
import { icons } from "../ui/theme";
import { runAuto } from "./auto";
import { runProfiles } from "./profiles";

/** Options for the `optimize` command. */
export interface OptimizeCommandOptions {
  /** Skip the download speedtest in both snapshots. */
  noSpeedtest?: boolean;
  /** Skip the MTU probe. */
  noMtu?: boolean;
  /** Apply every offered fix without asking — use with care. */
  yes?: boolean;
  /** Skip the second (after) snapshot. */
  noRetest?: boolean;
  /** Allow interactive prompts. */
  interactive?: boolean;
}

/** Apply a single auto-fix. Returns a friendly status line for the log. */
async function applyFix(fixId: FixId): Promise<string> {
  switch (fixId) {
    case "swap-dns": {
      await runAuto({ yes: true, interactive: false });
      return "Applied fastest DNS (see output above).";
    }
    case "flush-dns-cache": {
      const result = await flushDnsCache();
      return result.message;
    }
    case "restart-mdns": {
      const result = await restartMdns();
      return result.message;
    }
    case "prune-profiles": {
      // Hands off to the existing interactive multi-select picker — never
      // bulk-removes silently.
      await runProfiles("prune", { interactive: true });
      return "Profiles cleanup complete.";
    }
  }
}

/** Walk through fixable findings and run the ones the user approves. */
async function applyFixesInteractive(
  findings: Finding[],
  options: OptimizeCommandOptions,
): Promise<void> {
  const fixable = findings.filter((f) => f.fixable && f.fixId);
  if (fixable.length === 0) {
    p.log.info("Nothing to auto-fix in this snapshot.");
    return;
  }

  for (const finding of fixable) {
    const goAhead = options.yes
      ? true
      : guard(
          await p.confirm({
            message: `${pc.bold(finding.title)} — apply fix?`,
            initialValue: finding.severity !== "ok",
          }),
        );
    if (!goAhead) {
      p.log.message(pc.dim(`Skipped: ${finding.title}`));
      continue;
    }

    p.log.step(`Fix: ${finding.title}`);
    try {
      const message = await applyFix(finding.fixId as FixId);
      p.log.success(`${icons.ok} ${message}`);
    } catch (error) {
      p.log.error(error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * End-to-end optimization flow:
 *   1. Baseline snapshot + diagnose
 *   2. Walk the user through every auto-fixable finding
 *   3. Re-test and show before/after numbers
 */
export async function runOptimize(options: OptimizeCommandOptions = {}): Promise<void> {
  if (!(await pingAvailable())) {
    p.log.error(
      "`ping` is not available on this system — optimize needs it for latency, packet loss and MTU checks.",
    );
    return;
  }

  p.log.step("Step 1 of 3 — Baseline snapshot");
  const spin = p.spinner();
  spin.start("Measuring the current state of your connection…");
  const before: DiagnoseReport = await diagnose({
    skipSpeedtest: options.noSpeedtest,
    skipMtu: options.noMtu,
    onProgress: (step) => spin.message(step),
  });
  spin.stop("Baseline ready.");

  process.stdout.write(`\n${renderSnapshot(before.snapshot)}\n\n`);
  process.stdout.write(`${renderFindings(before.findings)}\n\n`);

  if (!options.interactive && !options.yes) {
    p.log.info(
      "`optimize` is interactive. Pass --yes to auto-apply all fixes, or use `bestdns diagnose` for a read-only report.",
    );
    return;
  }

  p.log.step("Step 2 of 3 — Apply auto-fixes");
  await applyFixesInteractive(before.findings, options);

  if (options.noRetest) {
    p.log.info("Skipping the after-snapshot (--no-retest).");
    return;
  }

  p.log.step("Step 3 of 3 — Re-test to verify");
  const retest = p.spinner();
  retest.start("Re-measuring after the fixes…");
  const after: NetworkSnapshot = await takeSnapshot({
    skipSpeedtest: options.noSpeedtest,
    skipMtu: options.noMtu,
    onProgress: (step) => retest.message(step),
  });
  retest.stop("After-snapshot ready.");

  process.stdout.write(`\n${renderComparison(before.snapshot, after)}\n\n`);
  p.log.success(`${icons.ok} Optimization flow complete.`);
}
