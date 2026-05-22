import * as p from "@clack/prompts";
import pc from "picocolors";
import { findProvider, getAllProviders, getProvidersByGroup } from "../catalog";
import { type HealthReport, checkHealth } from "../core/health";
import type { ProviderGroup } from "../types";
import { promptGroup } from "../ui/prompts";
import { renderHealthTable } from "../ui/render";
import { triState } from "../ui/theme";
import { pool } from "../util";

/** Options for the `health` command. */
export interface HealthCommandOptions {
  /** Inspect a single provider in detail. */
  provider?: string;
  /** Limit a multi-provider scan to a category. */
  group?: ProviderGroup | "all";
  /** Emit machine-readable JSON. */
  json?: boolean;
  /** Allow interactive prompts for missing input. */
  interactive?: boolean;
}

/** Shape a health report for JSON output. */
function reportToJson(report: HealthReport) {
  return {
    id: report.provider.id,
    name: report.provider.name,
    reachable: report.reachable,
    dnssec: report.dnssec,
    noHijacking: report.noHijacking,
    adsBlocked: report.adsBlocked,
    adsTested: report.adsTested,
    dohReachable: report.dohReachable,
  };
}

/** Detailed single-provider report, printed as one block. */
function printDetail(report: HealthReport): void {
  const { provider } = report;
  const check = (label: string, value: boolean | null): string => `    ${triState(value)} ${label}`;

  const lines = [
    `${pc.bold(provider.name)}  ${pc.dim(provider.ipv4.join(", "))}`,
    check("Reachable", report.reachable),
    check("DNSSEC validation", report.dnssec),
    check("No NXDOMAIN hijacking", report.noHijacking),
    `    ${triState(report.adsBlocked > 0)} Ad / tracker blocking ${pc.dim(
      `(${report.adsBlocked}/${report.adsTested} test domains blocked)`,
    )}`,
  ];
  if (report.dohReachable !== null) {
    lines.push(check("DNS-over-HTTPS reachable", report.dohReachable));
  }
  if (provider.doh) lines.push(`    ${pc.dim(`DoH: ${provider.doh}`)}`);
  if (provider.dot) lines.push(`    ${pc.dim(`DoT: ${provider.dot}`)}`);

  process.stdout.write(`\n${lines.join("\n")}\n`);
}

/**
 * Run capability / health checks. With a provider argument it prints a
 * detailed report; otherwise it prints a comparison matrix.
 */
export async function runHealth(options: HealthCommandOptions = {}): Promise<void> {
  // ── Single provider → detailed report ─────────────────────────────────
  if (options.provider) {
    const provider = findProvider(options.provider);
    if (!provider) {
      p.log.error(
        `Unknown provider "${options.provider}". Run \`bestdns list\` to see all options.`,
      );
      return;
    }
    const spin = p.spinner();
    spin.start(`Checking ${provider.name}…`);
    const report = await checkHealth(provider);
    spin.stop(`Health check complete — ${provider.name}`);

    if (options.json) {
      process.stdout.write(`${JSON.stringify(reportToJson(report), null, 2)}\n`);
      return;
    }
    printDetail(report);
    return;
  }

  // ── Multiple providers → comparison matrix ────────────────────────────
  let group = options.group;
  if (!group && options.interactive) group = await promptGroup(true);
  group ??= "all";

  const providers = group === "all" ? getAllProviders() : getProvidersByGroup(group);
  if (providers.length === 0) {
    p.log.warn("There are no providers to check in this category.");
    return;
  }

  const spin = p.spinner();
  spin.start(`Checking ${providers.length} providers…`);
  let done = 0;
  const reports = await pool(providers, 6, async (provider) => {
    const report = await checkHealth(provider);
    done += 1;
    spin.message(`Checking ${done}/${providers.length} — ${provider.name}`);
    return report;
  });
  spin.stop(`Checked ${providers.length} providers.`);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(reports.map(reportToJson), null, 2)}\n`);
    return;
  }

  process.stdout.write(`\n${renderHealthTable(reports)}\n\n`);
  p.log.message(
    pc.dim(
      "DNSSEC = validates signatures · No hijack = returns NXDOMAIN honestly · DoH = encrypted DNS",
    ),
  );
}
