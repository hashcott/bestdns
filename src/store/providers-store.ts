import type { DnsProvider } from "../types";
import { readJson, writeJson } from "./json-store";
import { CUSTOM_PROVIDERS_FILE } from "./paths";

/** Load every user-added DNS provider. */
export function loadCustomProviders(): DnsProvider[] {
  return readJson<DnsProvider[]>(CUSTOM_PROVIDERS_FILE, []).map((p) => ({
    ...p,
    custom: true,
  }));
}

/** Overwrite the stored list of custom providers. */
export function saveCustomProviders(providers: DnsProvider[]): void {
  writeJson(CUSTOM_PROVIDERS_FILE, providers);
}

/**
 * Add a custom provider. Throws if the id collides with an existing
 * custom entry.
 */
export function addCustomProvider(provider: DnsProvider): void {
  const list = loadCustomProviders();
  if (list.some((p) => p.id === provider.id)) {
    throw new Error(`A custom provider with id "${provider.id}" already exists.`);
  }
  list.push({ ...provider, custom: true });
  saveCustomProviders(list);
}

/** Remove a custom provider by id. Returns true when something was removed. */
export function removeCustomProvider(id: string): boolean {
  const list = loadCustomProviders();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  saveCustomProviders(next);
  return true;
}
