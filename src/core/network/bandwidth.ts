import { run } from "../../os/exec";

export interface BandwidthHog {
  pid: number;
  process: string;
  connections: number;
}

async function macBandwidthHogs(): Promise<BandwidthHog[]> {
  const res = await run("lsof", ["-i", "-n", "-P"], 8000);
  if (!res.ok) return [];

  const counts = new Map<string, { pid: number; count: number }>();

  for (const line of res.stdout.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const command = parts[0];
    const pid = Number(parts[1]);
    if (!command || !pid || command === "COMMAND") continue;

    const key = `${command}:${pid}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { pid, count: 1 });
    }
  }

  return Array.from(counts.entries())
    .map(([key, val]) => {
      const [process] = key.split(":");
      return { pid: val.pid, process: process ?? "", connections: val.count };
    })
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5);
}

async function linuxBandwidthHogs(): Promise<BandwidthHog[]> {
  const res = await run("ss", ["-tnp"], 8000);
  if (!res.ok) return [];

  const counts = new Map<string, { pid: number; count: number }>();

  for (const line of res.stdout.split("\n")) {
    const match = /users:\(\("([^"]+)",pid=(\d+)/.exec(line);
    if (!match) continue;
    const process = match[1];
    const pid = Number(match[2]);
    if (!process || !pid) continue;

    const key = `${process}:${pid}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { pid, count: 1 });
    }
  }

  return Array.from(counts.entries())
    .map(([key, val]) => {
      const [process] = key.split(":");
      return { pid: val.pid, process: process ?? "", connections: val.count };
    })
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5);
}

async function windowsBandwidthHogs(): Promise<BandwidthHog[]> {
  const script =
    "Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | " +
    "Group-Object OwningProcess | " +
    "Sort-Object Count -Descending | " +
    "Select-Object -First 5 @{N='PID';E={$_.Name}},Count," +
    "@{N='Process';E={(Get-Process -Id $_.Name -ErrorAction SilentlyContinue).ProcessName}} | " +
    "ConvertTo-Json -Compress";

  const res = await run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    10000,
  );
  if (!res.ok) return [];

  const trimmed = res.stdout.trim();
  if (!trimmed) return [];

  let items: Array<{ PID: string; Count: number; Process: string }>;
  try {
    const parsed = JSON.parse(trimmed);
    items = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }

  return items
    .filter((i) => i.Process && i.PID)
    .map((i) => ({
      pid: Number(i.PID),
      process: i.Process,
      connections: i.Count,
    }));
}

export async function detectBandwidthHogs(): Promise<BandwidthHog[]> {
  try {
    switch (process.platform) {
      case "darwin":
        return await macBandwidthHogs();
      case "linux":
        return await linuxBandwidthHogs();
      case "win32":
        return await windowsBandwidthHogs();
      default:
        return [];
    }
  } catch {
    return [];
  }
}
