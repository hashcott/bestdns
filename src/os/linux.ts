import { readFileSync } from "node:fs";
import { isDnsServer } from "../util";
import { isRoot, run, runInteractive } from "./exec";
import type { ApplyResult, DnsBackend, NetworkService } from "./types";

/**
 * Linux DNS backend. Linux has several competing DNS managers, so the
 * backend probes for one in priority order:
 *   1. NetworkManager (`nmcli`)   — most desktop distributions
 *   2. systemd-resolved (`resolvectl`)
 *   3. `/etc/resolv.conf`         — last-resort direct edit
 */

type Manager = "nmcli" | "resolvectl" | "resolvconf";

/** Check whether a command exists on PATH. */
async function hasCommand(cmd: string): Promise<boolean> {
  const res = await run("/bin/sh", ["-c", `command -v ${cmd}`]);
  return res.ok && res.stdout.trim().length > 0;
}

/** Pick the DNS manager to use. Cached after the first probe. */
let cachedManager: Manager | undefined;
async function manager(): Promise<Manager> {
  if (cachedManager) return cachedManager;
  if (await hasCommand("nmcli")) {
    const running = await run("nmcli", ["-t", "-f", "RUNNING", "general"]);
    if (running.ok && running.stdout.includes("running")) {
      cachedManager = "nmcli";
      return cachedManager;
    }
  }
  cachedManager = (await hasCommand("resolvectl")) ? "resolvectl" : "resolvconf";
  return cachedManager;
}

/** Device name carrying the default route. */
async function defaultDevice(): Promise<string | null> {
  const res = await run("ip", ["route", "show", "default"]);
  const match = /\bdev\s+(\S+)/.exec(res.stdout);
  return match ? (match[1] ?? null) : null;
}

// ─── NetworkManager ─────────────────────────────────────────────────────

async function nmcliServices(): Promise<NetworkService[]> {
  const res = await run("nmcli", [
    "-t",
    "-f",
    "NAME,DEVICE,STATE",
    "connection",
    "show",
    "--active",
  ]);
  const dev = await defaultDevice();
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", device = "", state = ""] = line.split(":");
      return {
        id: name,
        name: device ? `${name} (${device})` : name,
        active: device.length > 0 && device === dev,
        extra: { device, state },
      } satisfies NetworkService;
    });
}

async function nmcliGetDns(service: NetworkService): Promise<string[]> {
  const device = service.extra?.device;
  if (!device) return [];
  const res = await run("nmcli", ["-t", "-f", "IP4.DNS", "device", "show", device]);
  return res.stdout
    .split("\n")
    .map((l) => l.split(":").slice(1).join(":").trim())
    .filter((v) => isDnsServer(v));
}

// ─── systemd-resolved ───────────────────────────────────────────────────

async function resolvectlServices(): Promise<NetworkService[]> {
  const res = await run("resolvectl", ["status"]);
  const services: NetworkService[] = [];
  const re = /Link\s+\d+\s+\(([^)]+)\)/g;
  const dev = await defaultDevice();
  for (let m = re.exec(res.stdout); m; m = re.exec(res.stdout)) {
    const iface = (m[1] ?? "").trim();
    services.push({ id: iface, name: iface, active: iface === dev });
  }
  return services;
}

async function resolvectlGetDns(service: NetworkService): Promise<string[]> {
  const res = await run("resolvectl", ["dns", service.id]);
  // Output form: "Link 2 (wlan0): 1.1.1.1 1.0.0.1"
  const after = res.stdout.split(":").slice(1).join(":");
  return after
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((v) => isDnsServer(v));
}

// ─── /etc/resolv.conf fallback ──────────────────────────────────────────

const RESOLV_CONF = "/etc/resolv.conf";

function resolvConfGetDns(): string[] {
  try {
    return readFileSync(RESOLV_CONF, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("nameserver"))
      .map((l) => (l.split(/\s+/)[1] ?? "").trim())
      .filter((v) => isDnsServer(v));
  } catch {
    return [];
  }
}

// ─── Unified backend ────────────────────────────────────────────────────

async function listServices(): Promise<NetworkService[]> {
  switch (await manager()) {
    case "nmcli":
      return nmcliServices();
    case "resolvectl":
      return resolvectlServices();
    default:
      return [{ id: RESOLV_CONF, name: `System (${RESOLV_CONF})`, active: true }];
  }
}

async function getDns(service: NetworkService): Promise<string[]> {
  switch (await manager()) {
    case "nmcli":
      return nmcliGetDns(service);
    case "resolvectl":
      return resolvectlGetDns(service);
    default:
      return resolvConfGetDns();
  }
}

function setCommandParts(mgr: Manager, service: NetworkService, servers: string[]): string[][] {
  switch (mgr) {
    case "nmcli":
      return [
        [
          "nmcli",
          "connection",
          "modify",
          service.id,
          "ipv4.dns",
          servers.join(" "),
          "ipv4.ignore-auto-dns",
          "yes",
        ],
        ["nmcli", "connection", "up", service.id],
      ];
    case "resolvectl":
      return [["resolvectl", "dns", service.id, ...servers]];
    default:
      return [
        [
          "sh",
          "-c",
          `printf '%s\\n' ${servers.map((s) => `'nameserver ${s}'`).join(" ")} > ${RESOLV_CONF}`,
        ],
      ];
  }
}

function resetCommandParts(mgr: Manager, service: NetworkService): string[][] {
  switch (mgr) {
    case "nmcli":
      return [
        ["nmcli", "connection", "modify", service.id, "ipv4.dns", "", "ipv4.ignore-auto-dns", "no"],
        ["nmcli", "connection", "up", service.id],
      ];
    case "resolvectl":
      return [["resolvectl", "revert", service.id]];
    default:
      return [["true"]]; // resolv.conf is normally regenerated by the system
  }
}

function preview(parts: string[][]): string {
  return parts
    .map((p) => p.map((token) => (token.includes(" ") ? `"${token}"` : token)).join(" "))
    .join(" && ");
}

let cachedManagerForPreview: Manager = "nmcli";
// Resolve the manager early so `--dry-run` previews are accurate. Only
// meaningful on Linux, so the probe is skipped on other platforms.
if (process.platform === "linux") {
  void manager().then((m) => {
    cachedManagerForPreview = m;
  });
}

function previewSet(service: NetworkService, servers: string[]): string {
  return preview(setCommandParts(cachedManagerForPreview, service, servers));
}

function previewReset(service: NetworkService): string {
  return preview(resetCommandParts(cachedManagerForPreview, service));
}

/** Run a sequence of commands, elevating with `sudo` when not root. */
async function elevate(parts: string[][]): Promise<ApplyResult> {
  const command = preview(parts);
  for (const [cmd, ...args] of parts) {
    if (!cmd) continue;
    const code = isRoot()
      ? (await run(cmd, args)).code
      : await runInteractive("sudo", [cmd, ...args]);
    if (code !== 0) {
      return { ok: false, command, message: `Command failed: ${cmd}` };
    }
  }
  return { ok: true, command, message: "DNS settings updated." };
}

async function applySet(service: NetworkService, servers: string[]): Promise<ApplyResult> {
  return elevate(setCommandParts(await manager(), service, servers));
}

async function applyReset(service: NetworkService): Promise<ApplyResult> {
  const mgr = await manager();
  if (mgr === "resolvconf") {
    return {
      ok: false,
      command: previewReset(service),
      message:
        "Automatic reset is not available with a raw /etc/resolv.conf. Re-enable your network manager instead.",
    };
  }
  return elevate(resetCommandParts(mgr, service));
}

export const linuxBackend: DnsBackend = {
  platform: "linux",
  supported: true,
  listServices,
  getDns,
  previewSet,
  previewReset,
  applySet,
  applyReset,
};
