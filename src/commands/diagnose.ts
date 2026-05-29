import * as p from "@clack/prompts";
import pc from "picocolors";
import { diagnose, pingAvailable } from "../core/network/diagnose";
import type { DiagnoseReport } from "../core/network/types";
import { renderFindings, renderSnapshot } from "../ui/findings";

/** Options for the `diagnose` command. */
export interface DiagnoseCommandOptions {
  /** Skip the download speedtest. */
  noSpeedtest?: boolean;
  /** Skip the MTU probe. */
  noMtu?: boolean;
  /** Emit machine-readable JSON. */
  json?: boolean;
}

/** Run every diagnostic check and print a structured report. */
export async function runDiagnose(
  options: DiagnoseCommandOptions = {},
): Promise<DiagnoseReport | null> {
  if (!(await pingAvailable())) {
    p.log.error(
      "`ping` is not available on this system — diagnose needs it for latency, packet loss and MTU checks.",
    );
    return null;
  }

  if (options.json) {
    // No spinner: keeps stdout clean for machine consumers.
    const report = await diagnose({
      skipSpeedtest: options.noSpeedtest,
      skipMtu: options.noMtu,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  }

  const spin = p.spinner();
  spin.start("Diagnosing network…");
  const report = await diagnose({
    skipSpeedtest: options.noSpeedtest,
    skipMtu: options.noMtu,
    onProgress: (step) => spin.message(step),
  });
  spin.stop("Diagnostic complete.");

  process.stdout.write(`\n${renderSnapshot(report.snapshot)}\n\n`);
  process.stdout.write(`${renderFindings(report.findings)}\n\n`);
  p.log.message(
    pc.dim(
      "Run `bestdns optimize` to walk through the auto-fixable findings, or `bestdns auto` to swap DNS straight away.",
    ),
  );

  return report;
}
