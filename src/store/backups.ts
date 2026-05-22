import { readJson, writeJson } from "./json-store";
import { BACKUPS_FILE } from "./paths";

/** A snapshot of one network service's DNS settings before a change. */
export interface DnsBackup {
  /** ISO timestamp of when the snapshot was taken. */
  at: string;
  /** Operating system platform (`darwin` / `linux` / `win32`). */
  platform: string;
  /** Network service / interface the snapshot belongs to. */
  service: string;
  /** DNS servers that were configured. An empty array means "automatic/DHCP". */
  servers: string[];
}

const MAX_BACKUPS = 50;

/** Load the full backup history, newest last. */
export function loadBackups(): DnsBackup[] {
  return readJson<DnsBackup[]>(BACKUPS_FILE, []);
}

/** Append a backup, trimming history to the most recent entries. */
export function addBackup(backup: DnsBackup): void {
  const list = loadBackups();
  list.push(backup);
  writeJson(BACKUPS_FILE, list.slice(-MAX_BACKUPS));
}

/** The most recent backup recorded for a given network service. */
export function latestBackup(service: string): DnsBackup | undefined {
  return loadBackups()
    .filter((b) => b.service === service)
    .at(-1);
}
