import { getBackend, pickService } from "../../os";
import { timedQuery } from "../resolver";
import { listHogs } from "./hogs";
import { meanLatency, measureLatency } from "./latency";
import { detectMtu } from "./mtu";
import { measurePacketLoss } from "./packetloss";
import { pingAvailable } from "./ping";
import { listProfiles } from "./profiles";
import { runSpeedtest } from "./speedtest";
import { detectStaleProfiles } from "./stale-profiles";
import type { DiagnoseReport, Finding, NetworkSnapshot, SpeedtestResult } from "./types";
import { getWifiInfo } from "./wifi";

/** Options controlling which parts of `takeSnapshot` to run. */
export interface SnapshotOptions {
  /** Skip the download speedtest (faster diagnose). */
  skipSpeedtest?: boolean;
  /** Skip the MTU probe (it issues many small pings). */
  skipMtu?: boolean;
  /** Override the default Cloudflare test cap (bytes). */
  speedtestMaxBytes?: number;
  /** Per-step progress callback, used by spinners. */
  onProgress?: (step: string) => void;
}

/** Read the currently configured DNS and measure how fast it is. */
async function snapshotCurrentDns(): Promise<{ servers: string[]; avgMs: number | null }> {
  const backend = getBackend();
  if (!backend.supported) return { servers: [], avgMs: null };

  const services = await backend.listServices();
  const active = pickService(services);
  if (!active) return { servers: [], avgMs: null };

  const servers = await backend.getDns(active);
  const probe = servers[0];
  if (!probe) return { servers: [], avgMs: null };

  // Three quick queries against the currently-active resolver.
  const samples: number[] = [];
  for (const domain of ["google.com", "github.com", "wikipedia.org"]) {
    const outcome = await timedQuery(probe, domain, "A", 2500);
    if (outcome.responded) samples.push(outcome.ms);
  }
  const avgMs = samples.length === 0 ? null : samples.reduce((a, b) => a + b, 0) / samples.length;
  return { servers, avgMs };
}

/** Run every diagnostic measurement and bundle the results. */
export async function takeSnapshot(options: SnapshotOptions = {}): Promise<NetworkSnapshot> {
  const { onProgress } = options;

  onProgress?.("Checking current DNS…");
  const currentDns = await snapshotCurrentDns();

  onProgress?.("Measuring latency to anchor hosts…");
  const latency = await measureLatency();

  onProgress?.("Measuring packet loss…");
  const packetLoss = await measurePacketLoss();

  let mtu = { pathMtu: null, triedSizes: [], available: false } as Awaited<
    ReturnType<typeof detectMtu>
  >;
  if (!options.skipMtu) {
    onProgress?.("Probing path MTU…");
    mtu = await detectMtu();
  }

  onProgress?.("Reading Wi-Fi link…");
  const wifi = await getWifiInfo();

  let speedtest: SpeedtestResult = {
    ok: false,
    downloadMbps: 0,
    bytesTransferred: 0,
    durationMs: 0,
    error: "skipped",
  };
  if (!options.skipSpeedtest) {
    onProgress?.("Running download speedtest…");
    speedtest = await runSpeedtest({ maxBytes: options.speedtestMaxBytes });
  }

  return {
    takenAt: new Date().toISOString(),
    speedtest,
    latency,
    packetLoss,
    mtu,
    wifi,
    currentDns: currentDns.servers,
    currentDnsAvgMs: currentDns.avgMs,
  };
}

// ───────── Findings ───────────────────────────────────────────────────

/** Inspect a snapshot and produce a prioritised list of findings. */
export async function analyse(snapshot: NetworkSnapshot): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Download throughput.
  if (snapshot.speedtest.ok && snapshot.speedtest.downloadMbps > 0) {
    const mbps = snapshot.speedtest.downloadMbps;
    if (mbps < 10) {
      findings.push({
        id: "low-throughput",
        title: "Low download throughput",
        severity: "warning",
        detail: `Cloudflare speedtest measured ${mbps.toFixed(1)} Mbps (below 10 Mbps).`,
        suggestion: "Check VPNs, throttling apps, or run a longer ISP-grade speed test.",
      });
    } else {
      findings.push({
        id: "throughput-ok",
        title: "Download throughput is healthy",
        severity: "ok",
        detail: `Measured ${mbps.toFixed(1)} Mbps over ${(snapshot.speedtest.durationMs / 1000).toFixed(1)} s.`,
      });
    }
  } else if (!snapshot.speedtest.ok && snapshot.speedtest.error !== "skipped") {
    findings.push({
      id: "throughput-unknown",
      title: "Speedtest didn't complete",
      severity: "info",
      detail: snapshot.speedtest.error ?? "Unknown error from the speedtest endpoint.",
    });
  }

  // 2. Packet loss.
  const loss = snapshot.packetLoss.lossPct;
  if (snapshot.packetLoss.packetsSent > 0) {
    if (loss === 0) {
      findings.push({
        id: "packet-loss-ok",
        title: "No packet loss",
        severity: "ok",
        detail: `${snapshot.packetLoss.packetsReceived}/${snapshot.packetLoss.packetsSent} packets received from 1.1.1.1.`,
      });
    } else if (loss < 2) {
      findings.push({
        id: "packet-loss-low",
        title: "Very low packet loss",
        severity: "info",
        detail: `${loss.toFixed(1)}% loss is within normal noise.`,
      });
    } else if (loss < 10) {
      findings.push({
        id: "packet-loss-warning",
        title: "Elevated packet loss",
        severity: "warning",
        detail: `${loss.toFixed(1)}% packet loss to 1.1.1.1 — expect intermittent stalls.`,
        suggestion: "Move closer to your access point or switch to a wired link to confirm.",
      });
    } else {
      findings.push({
        id: "packet-loss-issue",
        title: "Severe packet loss",
        severity: "issue",
        detail: `${loss.toFixed(1)}% packet loss to 1.1.1.1 — connection is unreliable.`,
        suggestion: "Diagnose your local Wi-Fi/wiring before changing anything else.",
      });
    }
  }

  // 3. Internet latency.
  const avgLatency = meanLatency(snapshot.latency);
  if (avgLatency !== null) {
    if (avgLatency < 80) {
      findings.push({
        id: "latency-ok",
        title: "Internet latency looks fine",
        severity: "ok",
        detail: `${avgLatency.toFixed(0)} ms average across ${snapshot.latency.length} hosts.`,
      });
    } else if (avgLatency < 200) {
      findings.push({
        id: "latency-elevated",
        title: "Elevated latency to common hosts",
        severity: "info",
        detail: `${avgLatency.toFixed(0)} ms average — fine for browsing, noticeable for gaming.`,
      });
    } else {
      findings.push({
        id: "latency-high",
        title: "High internet latency",
        severity: "warning",
        detail: `${avgLatency.toFixed(0)} ms average across ${snapshot.latency.length} hosts.`,
        suggestion: "VPN, distant ISP route or congested Wi-Fi are the usual suspects.",
      });
    }
  } else {
    findings.push({
      id: "latency-unknown",
      title: "Could not measure internet latency",
      severity: "issue",
      detail: "No ping target responded — your machine may be offline.",
    });
  }

  // 4. Path MTU.
  if (snapshot.mtu.available) {
    if (snapshot.mtu.pathMtu === 1500) {
      findings.push({
        id: "mtu-ok",
        title: "Path MTU is 1500 (Ethernet baseline)",
        severity: "ok",
        detail: "Full-size packets reach 1.1.1.1 without fragmentation.",
      });
    } else if (snapshot.mtu.pathMtu && snapshot.mtu.pathMtu >= 1400) {
      findings.push({
        id: "mtu-reduced",
        title: `Path MTU is ${snapshot.mtu.pathMtu}`,
        severity: "info",
        detail: "Common when on PPPoE, GRE or a VPN — usually fine.",
      });
    } else if (snapshot.mtu.pathMtu) {
      findings.push({
        id: "mtu-low",
        title: `Path MTU is unusually low (${snapshot.mtu.pathMtu})`,
        severity: "warning",
        detail: "Lower MTU costs throughput. Likely a misconfigured tunnel.",
        suggestion: `Match your VPN / tunnel MTU to ${snapshot.mtu.pathMtu} or fix the tunnel overhead.`,
      });
    } else {
      findings.push({
        id: "mtu-unknown",
        title: "Path MTU could not be determined",
        severity: "info",
        detail: "Every candidate ping was blocked — your network may filter ICMP.",
      });
    }
  }

  // 5. Wi-Fi signal.
  if (snapshot.wifi.connected && typeof snapshot.wifi.signalDbm === "number") {
    const rssi = snapshot.wifi.signalDbm;
    const ssidLabel = snapshot.wifi.ssid ? ` (${snapshot.wifi.ssid})` : "";
    if (rssi >= -60) {
      findings.push({
        id: "wifi-strong",
        title: `Wi-Fi signal is strong${ssidLabel}`,
        severity: "ok",
        detail: `RSSI ${rssi} dBm — excellent.`,
      });
    } else if (rssi >= -70) {
      findings.push({
        id: "wifi-fair",
        title: `Wi-Fi signal is fair${ssidLabel}`,
        severity: "info",
        detail: `RSSI ${rssi} dBm — usable, expect some throughput loss.`,
      });
    } else {
      findings.push({
        id: "wifi-weak",
        title: `Wi-Fi signal is weak${ssidLabel}`,
        severity: "warning",
        detail: `RSSI ${rssi} dBm — interference or distance is hurting you.`,
        suggestion: "Move closer to the AP, switch to 5 GHz, or check for interfering devices.",
      });
    }
  }

  // 6. Current DNS performance.
  const dnsAvg = snapshot.currentDnsAvgMs;
  if (snapshot.currentDns.length === 0) {
    findings.push({
      id: "dns-automatic",
      title: "DNS is set to automatic (DHCP)",
      severity: "info",
      detail:
        "Your ISP picks the resolver — quality varies a lot. Run `bestdns auto` to pick a better one.",
      fixable: true,
      fixId: "swap-dns",
    });
  } else if (dnsAvg !== null && dnsAvg > 80) {
    findings.push({
      id: "dns-slow",
      title: "Current DNS is slow",
      severity: "warning",
      detail: `Current resolver averages ${dnsAvg.toFixed(0)} ms — most public resolvers are under 50 ms.`,
      fixable: true,
      fixId: "swap-dns",
      suggestion: "Run `bestdns auto` to benchmark and apply the fastest DNS.",
    });
  } else if (dnsAvg !== null) {
    findings.push({
      id: "dns-ok",
      title: "Current DNS is fast",
      severity: "ok",
      detail: `Current resolver averages ${dnsAvg.toFixed(0)} ms.`,
    });
  }

  // 7. Always offer a free cache flush — it never hurts and often helps.
  findings.push({
    id: "dns-cache",
    title: "Flush the OS DNS cache",
    severity: "info",
    detail: "Cheap, safe, and clears any stale records the OS is holding onto.",
    fixable: true,
    fixId: "flush-dns-cache",
  });

  // 8. macOS-only: offer to restart mDNSResponder.
  if (process.platform === "darwin") {
    findings.push({
      id: "mdns-restart",
      title: "Restart mDNSResponder",
      severity: "info",
      detail:
        "macOS's mDNS daemon occasionally needs a kick when local discovery (Bonjour) is sluggish.",
      fixable: true,
      fixId: "restart-mdns",
    });
  }

  // 9. Disabled / orphaned network services (informational — too risky to auto-remove).
  const staleProfiles = await detectStaleProfiles();
  if (staleProfiles.length > 0) {
    const names = staleProfiles
      .slice(0, 3)
      .map((p) => `"${p.name}" (${p.reason})`)
      .join(", ");
    const more = staleProfiles.length > 3 ? ` and ${staleProfiles.length - 3} more` : "";
    findings.push({
      id: "stale-services",
      title: `${staleProfiles.length} disabled network service(s)`,
      severity: "info",
      detail: `${names}${more} — clutter in System Settings → Network.`,
      suggestion:
        "Remove via System Settings → Network (macOS), nmcli (Linux), or Network Adapters (Windows).",
    });
  }

  // 10. Many saved Wi-Fi networks / NM connections — offer to prune in bulk.
  const profilesResult = await listProfiles();
  if (profilesResult.ok) {
    const savedCount = profilesResult.profiles.filter((p) => !p.active).length;
    if (savedCount > 5) {
      findings.push({
        id: "many-saved-profiles",
        title: `${savedCount} saved network profile(s) you may never use again`,
        severity: "info",
        detail:
          "Old Wi-Fi networks and connection profiles can clutter your network UI and " +
          "occasionally cause unwanted auto-connects.",
        fixable: true,
        fixId: "prune-profiles",
      });
    }
  }

  // 11. Network-hungry processes (informational only — `bestdns hogs` for the full list).
  const hogsResult = await listHogs(3);
  if (hogsResult.ok && hogsResult.hogs.length > 0) {
    const hasBytes = hogsResult.hogs.some((h) => h.bytesIn !== undefined);
    const top = hogsResult.hogs
      .map((h) => {
        const total = (h.bytesIn ?? 0) + (h.bytesOut ?? 0);
        if (hasBytes && total > 0) {
          const mb = total / 1024 / 1024;
          return `${h.process} (${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB)`;
        }
        return `${h.process} (${h.connections ?? 0} conn)`;
      })
      .join(", ");
    findings.push({
      id: "bandwidth-hogs",
      title: "Top network-hungry processes",
      severity: "info",
      detail: `${top}.`,
      suggestion:
        "Run `bestdns hogs` for the full list. bestdns never kills processes — close them yourself with Activity Monitor / Task Manager / `kill <PID>`.",
    });
  }

  return findings;
}

/** Take a snapshot and analyse it in one call. */
export async function diagnose(options: SnapshotOptions = {}): Promise<DiagnoseReport> {
  const snapshot = await takeSnapshot(options);
  const findings = await analyse(snapshot);
  return { snapshot, findings };
}

/** Whether the local `ping` binary is available (needed for most checks). */
export { pingAvailable };
