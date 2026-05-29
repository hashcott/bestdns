import Table from "cli-table3";
import pc from "picocolors";
import type { Finding, NetworkSnapshot, Severity } from "../core/network/types";

/** Coloured glyph for a severity level. */
function severityIcon(severity: Severity): string {
  switch (severity) {
    case "ok":
      return pc.green("✔");
    case "info":
      return pc.cyan("ℹ");
    case "warning":
      return pc.yellow("▲");
    case "issue":
      return pc.red("✘");
  }
}

/** Human label for a severity level. */
function severityLabel(severity: Severity): string {
  switch (severity) {
    case "ok":
      return pc.green("OK");
    case "info":
      return pc.cyan("INFO");
    case "warning":
      return pc.yellow("WARN");
    case "issue":
      return pc.red("ISSUE");
  }
}

/** Severity ranking used to sort findings worst-first. */
const SEVERITY_ORDER: Record<Severity, number> = {
  issue: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

/** Sort findings so the things that matter rise to the top. */
export function rankFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Render the headline numbers from a snapshot as a clean block of text. */
export function renderSnapshot(snapshot: NetworkSnapshot): string {
  const lines: string[] = [];
  const label = (text: string): string => pc.dim(text.padEnd(14));

  if (snapshot.speedtest.ok) {
    const mb = (snapshot.speedtest.bytesTransferred / 1024 / 1024).toFixed(1);
    const seconds = (snapshot.speedtest.durationMs / 1000).toFixed(1);
    const mbps = pc.bold(`${snapshot.speedtest.downloadMbps.toFixed(1)} Mbps`);
    const detail = pc.dim(`(${mb} MB in ${seconds} s)`);
    lines.push(`${label("Download")}${mbps} ${detail}`);
  } else if (snapshot.speedtest.error && snapshot.speedtest.error !== "skipped") {
    lines.push(`${label("Download")}${pc.red(snapshot.speedtest.error)}`);
  }

  const avgLatency =
    snapshot.latency.length > 0
      ? snapshot.latency.map((r) => r.ping.avgMs).filter((v): v is number => v !== null)
      : [];
  if (avgLatency.length > 0) {
    const mean = avgLatency.reduce((a, b) => a + b, 0) / avgLatency.length;
    lines.push(
      `${label("Latency")}${pc.bold(`${mean.toFixed(0)} ms`)} ${pc.dim(
        `avg across ${avgLatency.length} target(s)`,
      )}`,
    );
  }

  if (snapshot.packetLoss.packetsSent > 0) {
    const lossText = `${snapshot.packetLoss.lossPct.toFixed(1)}%`;
    const colored =
      snapshot.packetLoss.lossPct === 0
        ? pc.green(lossText)
        : snapshot.packetLoss.lossPct < 2
          ? pc.cyan(lossText)
          : snapshot.packetLoss.lossPct < 10
            ? pc.yellow(lossText)
            : pc.red(lossText);
    lines.push(
      `${label("Packet loss")}${colored} ${pc.dim(
        `(${snapshot.packetLoss.packetsReceived}/${snapshot.packetLoss.packetsSent} to 1.1.1.1)`,
      )}`,
    );
  }

  if (snapshot.mtu.pathMtu) {
    lines.push(`${label("Path MTU")}${pc.bold(String(snapshot.mtu.pathMtu))}`);
  }

  if (snapshot.wifi.connected) {
    const parts: string[] = [];
    if (snapshot.wifi.ssid) parts.push(snapshot.wifi.ssid);
    if (typeof snapshot.wifi.signalDbm === "number") parts.push(`${snapshot.wifi.signalDbm} dBm`);
    if (typeof snapshot.wifi.txRateMbps === "number")
      parts.push(`${snapshot.wifi.txRateMbps} Mbps`);
    if (parts.length > 0) {
      lines.push(
        `${label("Wi-Fi")}${pc.bold(parts[0] ?? "")} ${pc.dim(parts.slice(1).join(" · "))}`,
      );
    }
  }

  if (snapshot.currentDns.length > 0) {
    const detail =
      snapshot.currentDnsAvgMs !== null
        ? pc.dim(` (${snapshot.currentDnsAvgMs.toFixed(0)} ms avg)`)
        : "";
    lines.push(`${label("Current DNS")}${pc.cyan(snapshot.currentDns.join(", "))}${detail}`);
  } else {
    lines.push(`${label("Current DNS")}${pc.yellow("Automatic (DHCP)")}`);
  }

  return lines.join("\n");
}

/** Render the findings list as a sorted, easy-to-scan table. */
export function renderFindings(findings: Finding[]): string {
  const table = new Table({
    head: [pc.bold(""), pc.bold("Severity"), pc.bold("Finding"), pc.bold("Detail")],
    style: { head: [], border: [] },
    wordWrap: true,
    colWidths: [3, 9, 32, 60],
  });

  for (const finding of rankFindings(findings)) {
    const fix = finding.fixable ? pc.green(" (auto-fix available)") : "";
    const suggestion = finding.suggestion ? `\n${pc.dim(`→ ${finding.suggestion}`)}` : "";
    table.push([
      severityIcon(finding.severity),
      severityLabel(finding.severity),
      finding.title + fix,
      finding.detail + suggestion,
    ]);
  }

  return table.toString();
}

/** Compact before/after summary of two snapshots taken minutes apart. */
export function renderComparison(before: NetworkSnapshot, after: NetworkSnapshot): string {
  const rows: { label: string; before: string; after: string; delta: string }[] = [];

  const fmtMbps = (value: number): string => `${value.toFixed(1)} Mbps`;
  if (before.speedtest.ok && after.speedtest.ok) {
    const delta = after.speedtest.downloadMbps - before.speedtest.downloadMbps;
    rows.push({
      label: "Download",
      before: fmtMbps(before.speedtest.downloadMbps),
      after: fmtMbps(after.speedtest.downloadMbps),
      delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} Mbps`,
    });
  }

  const meanOf = (snap: NetworkSnapshot): number | null => {
    const vals = snap.latency.map((r) => r.ping.avgMs).filter((v): v is number => v !== null);
    return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const beforeLat = meanOf(before);
  const afterLat = meanOf(after);
  if (beforeLat !== null && afterLat !== null) {
    const delta = afterLat - beforeLat;
    rows.push({
      label: "Latency",
      before: `${beforeLat.toFixed(0)} ms`,
      after: `${afterLat.toFixed(0)} ms`,
      delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)} ms`,
    });
  }

  if (before.currentDnsAvgMs !== null && after.currentDnsAvgMs !== null) {
    const delta = after.currentDnsAvgMs - before.currentDnsAvgMs;
    rows.push({
      label: "DNS",
      before: `${before.currentDnsAvgMs.toFixed(0)} ms`,
      after: `${after.currentDnsAvgMs.toFixed(0)} ms`,
      delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)} ms`,
    });
  }

  if (rows.length === 0) return pc.dim("(not enough data to compare)");

  const table = new Table({
    head: [pc.bold("Metric"), pc.bold("Before"), pc.bold("After"), pc.bold("Δ")],
    style: { head: [], border: [] },
  });
  for (const row of rows) {
    const colour =
      row.delta.startsWith("-") || row.delta === "+0 ms" || row.delta === "+0.0 Mbps"
        ? pc.green
        : pc.red;
    // For download speed the "good" direction is +, for latency it's −.
    const isLatency = row.label !== "Download";
    const isImprovement = isLatency ? row.delta.startsWith("-") : !row.delta.startsWith("-");
    table.push([
      row.label,
      row.before,
      row.after,
      isImprovement ? pc.green(row.delta) : colour(row.delta),
    ]);
  }
  return table.toString();
}
