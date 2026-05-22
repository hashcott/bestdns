import Table from "cli-table3";
import pc from "picocolors";
import type { BenchmarkResult } from "../core/benchmark";
import type { HealthReport } from "../core/health";
import { GROUPS } from "../data/providers";
import type { DnsProvider } from "../types";
import { icons, paintGroup, triState } from "./theme";

/** Format a millisecond duration for display. */
export function formatMs(ms: number): string {
  if (ms <= 0) return pc.dim("—");
  return ms < 100 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}

/** Create a borderless table; colouring is handled by the caller. */
function newTable(head: string[]): Table.Table {
  return new Table({
    head: head.map((h) => pc.bold(h)),
    style: { head: [], border: [] },
  });
}

/** Benchmark leaderboard, fastest first, with the winner highlighted. */
export function renderBenchmarkTable(results: BenchmarkResult[]): string {
  const table = newTable(["#", "Provider", "Group", "Avg", "Fastest", "Jitter", "Reliability"]);

  results.forEach((result, index) => {
    const rank = index + 1;
    const isWinner = rank === 1 && !result.failed;
    const name = isWinner ? pc.bold(pc.green(result.provider.name)) : result.provider.name;

    table.push([
      isWinner ? pc.yellow(`★ ${rank}`) : pc.dim(String(rank)),
      `${name}\n${pc.dim(result.server)}`,
      paintGroup(result.provider.group, GROUPS[result.provider.group].label),
      result.failed ? pc.red("offline") : formatMs(result.avgMs),
      result.failed ? pc.dim("—") : formatMs(result.minMs),
      result.failed ? pc.dim("—") : `± ${formatMs(result.jitterMs)}`,
      result.failed ? pc.red("0%") : reliabilityCell(result.reliability),
    ]);
  });

  return table.toString();
}

/** Colour a reliability percentage by how healthy it is. */
function reliabilityCell(reliability: number): string {
  const pct = Math.round(reliability * 100);
  const label = `${pct}%`;
  if (pct >= 99) return pc.green(label);
  if (pct >= 90) return pc.yellow(label);
  return pc.red(label);
}

/** Catalog of providers, one row each. */
export function renderProvidersTable(providers: DnsProvider[]): string {
  const table = newTable(["ID", "Provider", "Group", "IPv4", "DoH", "Source"]);

  for (const provider of providers) {
    table.push([
      pc.cyan(provider.id),
      provider.name,
      paintGroup(provider.group, GROUPS[provider.group].label),
      provider.ipv4.join(", ") || pc.dim("—"),
      provider.doh ? icons.ok : icons.unknown,
      provider.custom ? pc.magenta("custom") : pc.dim("built-in"),
    ]);
  }

  return table.toString();
}

/** Capability / health matrix across providers. */
export function renderHealthTable(reports: HealthReport[]): string {
  const table = newTable(["Provider", "Reachable", "DNSSEC", "No hijack", "Ads blocked", "DoH"]);

  for (const report of reports) {
    table.push([
      report.provider.name,
      triState(report.reachable),
      triState(report.dnssec),
      triState(report.noHijacking),
      report.reachable ? `${report.adsBlocked}/${report.adsTested}` : pc.dim("—"),
      triState(report.dohReachable),
    ]);
  }

  return table.toString();
}
