import * as p from "@clack/prompts";
import pc from "picocolors";
import { getAllProviders } from "../catalog";
import { GROUPS, GROUP_ORDER } from "../data/providers";
import {
  addCustomProvider,
  loadCustomProviders,
  removeCustomProvider,
} from "../store/providers-store";
import type { DnsProvider, ProviderGroup } from "../types";
import { guard } from "../ui/prompts";
import { renderProvidersTable } from "../ui/render";
import { groupTag, icons } from "../ui/theme";
import { isDnsServer } from "../util";

/** Sub-actions of the `list` command. */
export type ListAction = "show" | "groups" | "add" | "remove";

/** Options for the `list` command. */
export interface ListCommandOptions {
  /** Provider id, used by `list remove`. */
  id?: string;
  /** Allow interactive prompts. */
  interactive?: boolean;
}

/** Print the full provider catalog as a table. */
function showCatalog(): void {
  const providers = getAllProviders();
  process.stdout.write(`\n${renderProvidersTable(providers)}\n\n`);
  p.log.message(
    pc.dim(`${providers.length} providers · use \`bestdns apply <id>\` or \`bestdns benchmark\``),
  );
}

/** Print the provider groups and how many providers each contains. */
function showGroups(): void {
  const all = getAllProviders();
  const lines: string[] = [];
  for (const group of GROUP_ORDER) {
    const meta = GROUPS[group];
    const count = all.filter((provider) => provider.group === group).length;
    lines.push(`${groupTag(group)}  ${pc.dim(`(${count} providers)`)}`);
    lines.push(`    ${pc.dim(meta.description)}`);
    lines.push("");
  }
  process.stdout.write(`\n${lines.join("\n")}\n`);
}

/** Parse a comma/space separated list of DNS server addresses. */
function parseServers(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Interactively add a custom provider to the catalog. */
async function addProvider(interactive: boolean): Promise<void> {
  if (!interactive) {
    p.log.error("`list add` is interactive — run `bestdns list add` in a terminal.");
    return;
  }

  const existingIds = new Set(getAllProviders().map((provider) => provider.id));

  const id = guard(
    await p.text({
      message: "Provider id (kebab-case, unique)",
      placeholder: "my-dns",
      validate: (value) => {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) return "Use lowercase letters, digits and dashes.";
        if (existingIds.has(value)) return "That id is already taken.";
        return undefined;
      },
    }),
  );

  const name = guard(
    await p.text({
      message: "Display name",
      placeholder: "My DNS",
      validate: (value) => (value.trim().length === 0 ? "A name is required." : undefined),
    }),
  );

  const group = guard(
    await p.select({
      message: "Category",
      options: GROUP_ORDER.map((value) => ({
        value,
        label: `${GROUPS[value].emoji} ${GROUPS[value].label}`,
        hint: GROUPS[value].description,
      })),
    }),
  ) as ProviderGroup;

  const ipv4Raw = guard(
    await p.text({
      message: "IPv4 addresses (comma separated)",
      placeholder: "1.1.1.1, 1.0.0.1",
      validate: (value) => {
        const servers = parseServers(value);
        if (servers.length === 0) return "At least one IPv4 address is required.";
        const bad = servers.find((server) => !isDnsServer(server));
        return bad ? `"${bad}" is not a valid address.` : undefined;
      },
    }),
  );

  const ipv6Raw = guard(
    await p.text({
      message: "IPv6 addresses (optional, comma separated)",
      placeholder: "leave blank to skip",
      defaultValue: "",
    }),
  );

  const doh = guard(
    await p.text({
      message: "DNS-over-HTTPS URL (optional)",
      placeholder: "https://example.com/dns-query",
      defaultValue: "",
    }),
  );

  const provider: DnsProvider = {
    id,
    name,
    group,
    ipv4: parseServers(ipv4Raw),
    custom: true,
  };
  const ipv6 = parseServers(ipv6Raw);
  if (ipv6.length > 0) provider.ipv6 = ipv6;
  if (doh.trim()) provider.doh = doh.trim();

  try {
    addCustomProvider(provider);
    p.log.success(`${icons.ok} Added "${name}" to the ${GROUPS[group].label} group.`);
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

/** Remove a custom provider, by id or via an interactive picker. */
async function removeProvider(options: ListCommandOptions): Promise<void> {
  const custom = loadCustomProviders();
  if (custom.length === 0) {
    p.log.warn("There are no custom providers to remove.");
    return;
  }

  let id = options.id;
  if (!id) {
    if (!options.interactive) {
      p.log.error("Specify a provider id: bestdns list remove <id>");
      return;
    }
    id = guard(
      await p.select({
        message: "Remove which custom provider?",
        options: custom.map((provider) => ({
          value: provider.id,
          label: provider.name,
          hint: provider.ipv4.join(", "),
        })),
      }),
    );
  }

  if (removeCustomProvider(id)) {
    p.log.success(`${icons.ok} Removed custom provider "${id}".`);
  } else {
    p.log.error(`No custom provider with id "${id}" was found.`);
  }
}

/** Entry point for the `list` command and its sub-actions. */
export async function runList(action: ListAction, options: ListCommandOptions = {}): Promise<void> {
  switch (action) {
    case "show":
      showCatalog();
      return;
    case "groups":
      showGroups();
      return;
    case "add":
      await addProvider(Boolean(options.interactive));
      return;
    case "remove":
      await removeProvider(options);
      return;
  }
}
