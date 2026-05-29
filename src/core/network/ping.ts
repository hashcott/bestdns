import { run } from "../../os/exec";
import type { PingResult } from "./types";

/** Build platform-correct `ping` arguments. */
function pingArgs(
  host: string,
  count: number,
  options: { df?: boolean; payloadBytes?: number; perPingTimeoutSec?: number } = {},
): string[] {
  const { df = false, payloadBytes, perPingTimeoutSec = 2 } = options;

  if (process.platform === "win32") {
    return [
      "-n",
      String(count),
      ...(df ? ["-f"] : []),
      ...(payloadBytes !== undefined ? ["-l", String(payloadBytes)] : []),
      "-w",
      String(perPingTimeoutSec * 1000),
      host,
    ];
  }

  if (process.platform === "linux") {
    return [
      "-c",
      String(count),
      "-W",
      String(perPingTimeoutSec),
      ...(df ? ["-M", "do"] : []),
      ...(payloadBytes !== undefined ? ["-s", String(payloadBytes)] : []),
      host,
    ];
  }

  // darwin (macOS) and other BSDs
  return [
    "-c",
    String(count),
    "-W",
    String(perPingTimeoutSec * 1000),
    ...(df ? ["-D"] : []),
    ...(payloadBytes !== undefined ? ["-s", String(payloadBytes)] : []),
    host,
  ];
}

/** Run `ping` against `host` and return a parsed result. Never throws. */
export async function ping(
  host: string,
  count: number,
  options: { df?: boolean; payloadBytes?: number; timeoutMs?: number } = {},
): Promise<PingResult> {
  const args = pingArgs(host, count, options);
  const timeout = options.timeoutMs ?? Math.max(8000, count * 1500 + 4000);
  const result = await run("ping", args, timeout);
  return parsePing(`${result.stdout}\n${result.stderr}`, count);
}

/**
 * Parse the output of `ping` from macOS, Linux or Windows. The three
 * variants format both the loss summary and the RTT summary differently.
 */
export function parsePing(output: string, expectedCount: number): PingResult {
  let sent = expectedCount;
  let received = 0;
  let lossPct = 100;
  let avgMs: number | null = null;

  // macOS/Linux loss line.
  const unixLoss =
    /(\d+)\s+packets transmitted[^\d]+(\d+)\s+(?:packets )?received[^\d]+([\d.]+)%\s+packet loss/.exec(
      output,
    );
  if (unixLoss) {
    sent = Number(unixLoss[1]);
    received = Number(unixLoss[2]);
    lossPct = Number(unixLoss[3]);
  } else {
    // Windows loss line spans multiple keywords on the same logical line.
    const winLoss =
      /Sent\s*=\s*(\d+).*Received\s*=\s*(\d+).*Lost\s*=\s*(\d+)\s*\((\d+)%\s*loss\)/s.exec(output);
    if (winLoss) {
      sent = Number(winLoss[1]);
      received = Number(winLoss[2]);
      lossPct = Number(winLoss[4]);
    }
  }

  // macOS/Linux: round-trip|rtt min/avg/max/stddev|mdev = 1.2/3.4/5.6/0.1 ms
  const unixRtt =
    /(?:round-trip|rtt)\s+min\/avg\/max\/(?:stddev|mdev)\s*=\s*[\d.]+\/([\d.]+)\//.exec(output);
  if (unixRtt) {
    avgMs = Number(unixRtt[1]);
  } else {
    // Windows: Average = 12ms
    const winAvg = /Average\s*=\s*(\d+)\s*ms/i.exec(output);
    if (winAvg) avgMs = Number(winAvg[1]);
  }

  return {
    ok: received > 0,
    lossPct,
    avgMs,
    packetsSent: sent,
    packetsReceived: received,
    raw: output,
  };
}

/** Best-effort check that the OS `ping` command exists on PATH. */
export async function pingAvailable(): Promise<boolean> {
  if (process.platform === "win32") {
    const r = await run("ping", ["-n", "1", "-w", "100", "127.0.0.1"], 3000);
    return r.code === 0 || /Reply from/.test(r.stdout);
  }
  const r = await run("ping", ["-c", "1", "-W", "1", "127.0.0.1"], 3000);
  return r.code === 0;
}
