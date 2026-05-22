import { BUILT_IN_PROVIDERS } from "./data/providers";
import { loadCustomProviders } from "./store/providers-store";
import type { DnsProvider, ProviderGroup } from "./types";

/** Every known provider: built-in catalog first, then user-added entries. */
export function getAllProviders(): DnsProvider[] {
  return [...BUILT_IN_PROVIDERS, ...loadCustomProviders()];
}

/** Providers belonging to a single group. */
export function getProvidersByGroup(group: ProviderGroup): DnsProvider[] {
  return getAllProviders().filter((p) => p.group === group);
}

/** Find a provider by exact id or case-insensitive name match. */
export function findProvider(query: string): DnsProvider | undefined {
  const q = query.trim().toLowerCase();
  return getAllProviders().find((p) => p.id.toLowerCase() === q || p.name.toLowerCase() === q);
}

/**
 * Identify which catalog provider a set of configured DNS servers belongs
 * to, by matching any address. Useful for labelling the current DNS.
 */
export function matchProviderByServers(servers: string[]): DnsProvider | undefined {
  const configured = new Set(servers.map((s) => s.trim().toLowerCase()));
  return getAllProviders().find((p) =>
    [...p.ipv4, ...(p.ipv6 ?? [])].some((ip) => configured.has(ip.toLowerCase())),
  );
}
