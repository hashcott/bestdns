import { isDnsServer } from "../util";
import { run } from "./exec";
import type { ApplyResult, DnsBackend, NetworkService } from "./types";

/**
 * Windows DNS backend, built on PowerShell's `DnsClient` cmdlets.
 * Mutations are run through `Start-Process -Verb RunAs`, which raises a UAC
 * prompt so the user does not need to pre-launch an elevated terminal.
 */

const POWERSHELL = "powershell.exe";

/** Run a PowerShell script and capture stdout. */
async function pwsh(script: string, timeout = 20000): Promise<string> {
  const res = await run(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", script], timeout);
  return res.stdout;
}

/** Parse PowerShell `ConvertTo-Json` output, normalising to an array. */
function parseJsonArray<T>(text: string): T[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as T | T[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

async function listServices(): Promise<NetworkService[]> {
  const adapters = parseJsonArray<{ Name: string; InterfaceIndex: number }>(
    await pwsh(
      "ConvertTo-Json -Compress -InputObject @(Get-NetAdapter -Physical " +
        "| Where-Object { $_.Status -eq 'Up' } " +
        "| Select-Object Name,InterfaceIndex)",
    ),
  );

  const activeIndex = (
    await pwsh(
      "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue " +
        "| Sort-Object RouteMetric | Select-Object -First 1).InterfaceIndex",
    )
  ).trim();

  return adapters.map((a) => ({
    id: String(a.InterfaceIndex),
    name: a.Name,
    active: String(a.InterfaceIndex) === activeIndex,
    extra: { interfaceIndex: String(a.InterfaceIndex) },
  }));
}

async function getDns(service: NetworkService): Promise<string[]> {
  const out = await pwsh(
    `ConvertTo-Json -Compress -InputObject @((Get-DnsClientServerAddress -InterfaceIndex ${service.id} -AddressFamily IPv4).ServerAddresses)`,
  );
  return parseJsonArray<string>(out).filter((v) => isDnsServer(String(v)));
}

function previewSet(service: NetworkService, servers: string[]): string {
  const list = servers.map((s) => `"${s}"`).join(",");
  return `Set-DnsClientServerAddress -InterfaceIndex ${service.id} -ServerAddresses (${list})`;
}

function previewReset(service: NetworkService): string {
  return `Set-DnsClientServerAddress -InterfaceIndex ${service.id} -ResetServerAddresses`;
}

/** Run a DnsClient cmdlet elevated via UAC and wait for it to finish. */
async function elevate(inner: string): Promise<ApplyResult> {
  const script = `$p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile','-Command','${inner}'; exit $p.ExitCode`;
  const res = await run(POWERSHELL, ["-NoProfile", "-Command", script], 120000);
  return {
    ok: res.ok,
    command: inner,
    message: res.ok ? "DNS settings updated." : "Elevation was cancelled or the command failed.",
  };
}

function applySet(service: NetworkService, servers: string[]): Promise<ApplyResult> {
  return elevate(previewSet(service, servers));
}

function applyReset(service: NetworkService): Promise<ApplyResult> {
  return elevate(previewReset(service));
}

export const windowsBackend: DnsBackend = {
  platform: "win32",
  supported: true,
  listServices,
  getDns,
  previewSet,
  previewReset,
  applySet,
  applyReset,
};
