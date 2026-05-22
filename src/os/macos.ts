import { isDnsServer } from "../util";
import { isRoot, run, runInteractive } from "./exec";
import type { ApplyResult, DnsBackend, NetworkService } from "./types";

/**
 * macOS DNS backend, built on `networksetup`. This is the reference
 * implementation and the fully-tested platform.
 */

const NETWORKSETUP = "/usr/sbin/networksetup";

/** Interface name (e.g. `en0`) carrying the default route. */
async function activeInterface(): Promise<string | null> {
  const res = await run("/sbin/route", ["-n", "get", "default"]);
  const match = /interface:\s*(\S+)/.exec(res.stdout);
  return match ? (match[1] ?? null) : null;
}

/** Map an interface name back to its human network-service name. */
async function serviceForInterface(iface: string): Promise<string | null> {
  const res = await run(NETWORKSETUP, ["-listnetworkserviceorder"]);
  const re = /\(\d+\)\s*(.+)\r?\n\(Hardware Port:[^,]*,\s*Device:\s*([^)]+)\)/g;
  for (let m = re.exec(res.stdout); m; m = re.exec(res.stdout)) {
    if ((m[2] ?? "").trim() === iface) return (m[1] ?? "").trim();
  }
  return null;
}

async function listServices(): Promise<NetworkService[]> {
  const res = await run(NETWORKSETUP, ["-listallnetworkservices"]);
  const names = res.stdout
    .split("\n")
    .slice(1) // first line is an explanatory note
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("*"));

  const iface = await activeInterface();
  const activeName = iface ? await serviceForInterface(iface) : null;

  return names.map((name) => ({ id: name, name, active: name === activeName }));
}

async function getDns(service: NetworkService): Promise<string[]> {
  const res = await run(NETWORKSETUP, ["-getdnsservers", service.id]);
  // When nothing is set, the output is a human sentence rather than IPs.
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => isDnsServer(l));
}

function previewSet(service: NetworkService, servers: string[]): string {
  return `networksetup -setdnsservers "${service.id}" ${servers.join(" ")}`;
}

function previewReset(service: NetworkService): string {
  return `networksetup -setdnsservers "${service.id}" empty`;
}

/** Run a `networksetup` mutation, elevating with `sudo` when not root. */
async function elevate(args: string[], preview: string): Promise<ApplyResult> {
  if (isRoot()) {
    const res = await run(NETWORKSETUP, args);
    return {
      ok: res.ok,
      command: preview,
      message: res.ok ? "DNS settings updated." : res.stderr || res.stdout || "Command failed.",
    };
  }
  const code = await runInteractive("sudo", [NETWORKSETUP, ...args]);
  return {
    ok: code === 0,
    command: `sudo ${preview}`,
    message: code === 0 ? "DNS settings updated." : "Command failed or was cancelled.",
  };
}

function applySet(service: NetworkService, servers: string[]): Promise<ApplyResult> {
  return elevate(["-setdnsservers", service.id, ...servers], previewSet(service, servers));
}

function applyReset(service: NetworkService): Promise<ApplyResult> {
  return elevate(["-setdnsservers", service.id, "empty"], previewReset(service));
}

export const macosBackend: DnsBackend = {
  platform: "darwin",
  supported: true,
  listServices,
  getDns,
  previewSet,
  previewReset,
  applySet,
  applyReset,
};
