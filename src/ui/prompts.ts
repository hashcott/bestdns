import * as p from "@clack/prompts";
import { getAllProviders } from "../catalog";
import { GROUPS, GROUP_ORDER } from "../data/providers";
import type { DnsBackend, NetworkService } from "../os";
import type { DnsProvider, ProviderGroup } from "../types";
import { groupLabel } from "./theme";

/**
 * Unwrap a clack prompt result, exiting cleanly if the user cancelled
 * (Ctrl+C / Esc). Keeps call sites free of repetitive cancel handling.
 */
export function guard<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Cancelled — no changes were made.");
    process.exit(0);
  }
  return value as T;
}

/** True when interactive prompts are possible (both stdio ends are a TTY). */
export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Prompt the user to choose a DNS provider from the full catalog. */
export async function promptProvider(message = "Choose a DNS provider"): Promise<DnsProvider> {
  const providers = getAllProviders();
  const id = guard(
    await p.select({
      message,
      options: providers.map((provider) => ({
        value: provider.id,
        label: provider.name,
        hint: `${groupLabel(provider.group)} · ${provider.ipv4[0] ?? ""}`,
      })),
    }),
  );
  return providers.find((provider) => provider.id === id) as DnsProvider;
}

/** Prompt the user to choose a network service to act on. */
export async function promptService(
  backend: DnsBackend,
  message = "Choose a network service",
): Promise<NetworkService> {
  const services = await backend.listServices();
  if (services.length === 0) {
    throw new Error("No configurable network services were found.");
  }
  if (services.length === 1) return services[0] as NetworkService;

  const active = services.find((service) => service.active) ?? services[0];
  const id = guard(
    await p.select({
      message,
      initialValue: active?.id,
      options: services.map((service) => ({
        value: service.id,
        label: service.name,
        hint: service.active ? "active connection" : undefined,
      })),
    }),
  );
  return services.find((service) => service.id === id) as NetworkService;
}

/** Prompt the user to choose a provider category (optionally "all"). */
export async function promptGroup(includeAll = true): Promise<ProviderGroup | "all"> {
  const options: { value: ProviderGroup | "all"; label: string; hint: string }[] = [];
  if (includeAll) {
    options.push({ value: "all", label: "All providers", hint: "test every category" });
  }
  for (const group of GROUP_ORDER) {
    options.push({
      value: group,
      label: groupLabel(group),
      hint: GROUPS[group].description,
    });
  }
  return guard(await p.select({ message: "Which category?", options }));
}
