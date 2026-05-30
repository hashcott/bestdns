import { run } from "../../os/exec";

/** A single process and its observable network activity. */
export interface NetworkHog {
  /** Operating-system process id, when we could determine it. */
  pid?: number;
  /** Display name of the process. */
  process: string;
  /** Bytes received since the process started (macOS only). */
  bytesIn?: number;
  /** Bytes sent since the process started (macOS only). */
  bytesOut?: number;
  /** Established network connections held by the process. */
  connections?: number;
}

/** Outcome of the OS-specific network-hog scan. */
export interface HogsResult {
  ok: boolean;
  /** Top processes by bytes (macOS) or connection count (others). */
  hogs: NetworkHog[];
  /** Which underlying tool produced the data. */
  mechanism: string;
  /** Caveats worth surfacing in the UI (e.g. needs sudo for names). */
  notes?: string;
}

// ─── macOS ─────────────────────────────────────────────────────────────

/**
 * Parse `nettop -P -L 1 -J bytes_in,bytes_out -x` output. Each data line is
 * `processname.pid,bytes_in,bytes_out,`. The process name itself may
 * contain dots, so the pid is everything after the *last* dot.
 */
export function parseNettopOutput(output: string): NetworkHog[] {
  const hogs: NetworkHog[] = [];
  for (const line of output.split("\n")) {
    const fields = line.trim().split(",");
    if (fields.length < 3) continue;
    const label = fields[0] ?? "";
    if (!label || label === "bytes_in") continue; // header

    const lastDot = label.lastIndexOf(".");
    const maybePid = lastDot >= 0 ? label.slice(lastDot + 1) : "";
    const pid = /^\d+$/.test(maybePid) ? Number(maybePid) : undefined;
    const name = lastDot >= 0 && pid !== undefined ? label.slice(0, lastDot) : label;

    const bytesIn = Number(fields[1]);
    const bytesOut = Number(fields[2]);
    if (!Number.isFinite(bytesIn) || !Number.isFinite(bytesOut)) continue;

    hogs.push({ pid, process: name, bytesIn, bytesOut });
  }
  return hogs;
}

async function macHogs(): Promise<HogsResult> {
  const res = await run("nettop", ["-P", "-L", "1", "-J", "bytes_in,bytes_out", "-x"], 10000);
  if (!res.ok && res.stdout.length === 0) {
    return { ok: false, hogs: [], mechanism: "nettop", notes: res.stderr || "nettop failed." };
  }
  return { ok: true, hogs: parseNettopOutput(res.stdout), mechanism: "nettop" };
}

// ─── Linux ─────────────────────────────────────────────────────────────

/**
 * Parse `ss -tunap` lines and aggregate established connections per
 * process. Process names appear in the `users:(("name",pid=N,fd=M))`
 * column — present only when `ss` runs with the privileges needed to
 * inspect socket ownership (usually root).
 */
export function parseSsOutput(output: string): NetworkHog[] {
  const byProcess = new Map<string, NetworkHog>();
  const re = /\("([^"]+)",pid=(\d+),/g;

  for (const line of output.split("\n")) {
    if (!/^tcp\s+(ESTAB|estab)/i.test(line) && !/^tcp\s+ESTABLISHED/i.test(line)) {
      continue;
    }
    re.lastIndex = 0;
    for (let m = re.exec(line); m; m = re.exec(line)) {
      const name = m[1] ?? "";
      const pid = Number(m[2]);
      const key = `${name}#${pid}`;
      const existing = byProcess.get(key) ?? { pid, process: name, connections: 0 };
      existing.connections = (existing.connections ?? 0) + 1;
      byProcess.set(key, existing);
    }
  }
  return Array.from(byProcess.values());
}

async function linuxHogs(): Promise<HogsResult> {
  const res = await run("ss", ["-tunap"], 8000);
  if (!res.ok) {
    return {
      ok: false,
      hogs: [],
      mechanism: "ss",
      notes: "`ss` not available — install iproute2.",
    };
  }
  const hogs = parseSsOutput(res.stdout);
  return {
    ok: true,
    hogs,
    mechanism: "ss",
    notes:
      hogs.length === 0
        ? "No process info — re-run with sudo to see which process owns each connection."
        : undefined,
  };
}

// ─── Windows ───────────────────────────────────────────────────────────

interface WinHog {
  Process: string;
  PID: number;
  Connections: number;
}

async function windowsHogs(): Promise<HogsResult> {
  const script = `
$rows = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
  Group-Object OwningProcess |
  ForEach-Object {
    $proc = Get-Process -Id $_.Name -ErrorAction SilentlyContinue
    [PSCustomObject]@{
      Process = if ($proc) { $proc.ProcessName } else { "PID $($_.Name)" }
      PID     = [int]$_.Name
      Connections = $_.Count
    }
  }
ConvertTo-Json -Compress -InputObject @($rows)
`;
  const res = await run("powershell.exe", ["-NoProfile", "-Command", script], 15000);
  if (!res.ok) {
    return { ok: false, hogs: [], mechanism: "Get-NetTCPConnection", notes: res.stderr };
  }
  try {
    const text = res.stdout.trim();
    if (!text) return { ok: true, hogs: [], mechanism: "Get-NetTCPConnection" };
    const parsed = JSON.parse(text) as WinHog | WinHog[];
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return {
      ok: true,
      mechanism: "Get-NetTCPConnection",
      hogs: list.map((row) => ({
        pid: row.PID,
        process: row.Process,
        connections: row.Connections,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      hogs: [],
      mechanism: "Get-NetTCPConnection",
      notes: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Public API ────────────────────────────────────────────────────────

/** Sort a list of hogs by the strongest available signal (bytes > connections). */
export function rankHogs(hogs: NetworkHog[]): NetworkHog[] {
  return [...hogs].sort((a, b) => {
    const aTotal = (a.bytesIn ?? 0) + (a.bytesOut ?? 0);
    const bTotal = (b.bytesIn ?? 0) + (b.bytesOut ?? 0);
    if (aTotal !== bTotal) return bTotal - aTotal;
    return (b.connections ?? 0) - (a.connections ?? 0);
  });
}

/** List the processes generating the most network traffic right now. */
export async function listHogs(topN = 10): Promise<HogsResult> {
  let result: HogsResult;
  switch (process.platform) {
    case "darwin":
      result = await macHogs();
      break;
    case "linux":
      result = await linuxHogs();
      break;
    case "win32":
      result = await windowsHogs();
      break;
    default:
      return {
        ok: false,
        hogs: [],
        mechanism: "n/a",
        notes: `Listing network hogs is not implemented for ${process.platform}.`,
      };
  }
  result.hogs = rankHogs(result.hogs).slice(0, topN);
  return result;
}
