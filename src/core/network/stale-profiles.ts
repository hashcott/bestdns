import { run } from "../../os/exec";

export interface StaleProfile {
  name: string;
  reason: string;
}

async function macStaleProfiles(): Promise<StaleProfile[]> {
  const stale: StaleProfile[] = [];

  const list = await run("/usr/sbin/networksetup", ["-listallnetworkservices"], 5000);
  if (!list.ok) return [];

  const lines = list.stdout
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("*")) {
      stale.push({ name: line.slice(1), reason: "disabled" });
    }
  }

  const order = await run("/usr/sbin/networksetup", ["-listnetworkserviceorder"], 5000);
  if (order.ok) {
    const re = /\(\d+\)\s*(.+)\r?\n\(Hardware Port:[^,]*,\s*Device:\s*([^)]+)\)/g;
    const activeServices = new Set<string>();
    for (let m = re.exec(order.stdout); m; m = re.exec(order.stdout)) {
      const name = (m[1] ?? "").trim();
      const device = (m[2] ?? "").trim();
      const info = await run("/usr/sbin/networksetup", ["-getinfo", name], 3000);
      if (info.ok && /Ethernet Address:\s*None/i.test(info.stdout) && device) {
        const hasIp = /IP address:\s*\S+/i.test(info.stdout);
        if (!hasIp) {
          stale.push({ name, reason: "no hardware connected" });
        }
      }
      if (!stale.some((s) => s.name === name)) {
        activeServices.add(name);
      }
    }
  }

  return deduplicate(stale);
}

async function linuxStaleProfiles(): Promise<StaleProfile[]> {
  const stale: StaleProfile[] = [];

  const hasNmcli = await run("/bin/sh", ["-c", "command -v nmcli"]);
  if (!hasNmcli.ok) return [];

  const res = await run("nmcli", ["-t", "-f", "NAME,DEVICE,STATE", "connection", "show"], 5000);
  if (!res.ok) return [];

  for (const line of res.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(":");
    const name = parts[0] ?? "";
    const device = parts[1] ?? "";
    const state = parts[2] ?? "";
    if (state === "disconnected" || state === "unavailable") {
      stale.push({ name, reason: state });
    } else if (!device && state !== "activated") {
      stale.push({ name, reason: `state: ${state || "unknown"}` });
    }
  }

  return deduplicate(stale);
}

async function windowsStaleProfiles(): Promise<StaleProfile[]> {
  const stale: StaleProfile[] = [];

  const script =
    "ConvertTo-Json -Compress -InputObject @(" +
    "Get-NetAdapter | Select-Object Name,Status,MediaConnectionState)";
  const res = await run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    10000,
  );
  if (!res.ok) return [];

  const trimmed = res.stdout.trim();
  if (!trimmed) return [];

  let adapters: Array<{ Name: string; Status: string; MediaConnectionState: string }>;
  try {
    const parsed = JSON.parse(trimmed);
    adapters = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }

  for (const a of adapters) {
    if (a.Status === "Disabled") {
      stale.push({ name: a.Name, reason: "adapter disabled" });
    } else if (a.MediaConnectionState === "Disconnected" && a.Status !== "Up") {
      stale.push({ name: a.Name, reason: "disconnected" });
    }
  }

  return deduplicate(stale);
}

function deduplicate(profiles: StaleProfile[]): StaleProfile[] {
  const seen = new Set<string>();
  return profiles.filter((p) => {
    const key = `${p.name}:${p.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function detectStaleProfiles(): Promise<StaleProfile[]> {
  try {
    switch (process.platform) {
      case "darwin":
        return await macStaleProfiles();
      case "linux":
        return await linuxStaleProfiles();
      case "win32":
        return await windowsStaleProfiles();
      default:
        return [];
    }
  } catch {
    return [];
  }
}
