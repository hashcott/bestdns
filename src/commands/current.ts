import * as p from "@clack/prompts";
import pc from "picocolors";
import { matchProviderByServers } from "../catalog";
import { getBackend } from "../os";
import { groupTag, icons } from "../ui/theme";

/** Options for the `current` command. */
export interface CurrentCommandOptions {
  /** Emit machine-readable JSON instead of formatted text. */
  json?: boolean;
}

/** Show the DNS configuration of every network service. */
export async function runCurrent(options: CurrentCommandOptions = {}): Promise<void> {
  const backend = getBackend();
  if (!backend.supported) {
    p.log.error(backend.unsupportedReason ?? "This platform is not supported.");
    return;
  }

  const services = await backend.listServices();
  const rows = [];
  for (const service of services) {
    const servers = await backend.getDns(service);
    rows.push({ service, servers, match: matchProviderByServers(servers) });
  }

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        rows.map(({ service, servers, match }) => ({
          service: service.name,
          id: service.id,
          active: service.active,
          automatic: servers.length === 0,
          servers,
          provider: match ? { id: match.id, name: match.name, group: match.group } : null,
        })),
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (rows.length === 0) {
    p.log.warn("No network services were found.");
    return;
  }

  const lines: string[] = [];
  for (const { service, servers, match } of rows) {
    lines.push(
      service.active
        ? `${icons.arrow} ${pc.bold(service.name)} ${pc.green("(active)")}`
        : `${icons.bullet} ${service.name}`,
    );
    if (servers.length === 0) {
      lines.push(`    ${pc.dim("DNS")}       ${pc.yellow("Automatic (DHCP)")}`);
    } else {
      lines.push(`    ${pc.dim("DNS")}       ${pc.cyan(servers.join(", "))}`);
      lines.push(
        `    ${pc.dim("Provider")}  ${
          match ? `${match.name}  ${groupTag(match.group)}` : pc.dim("Unrecognised / custom")
        }`,
      );
    }
    lines.push("");
  }
  process.stdout.write(`\n${lines.join("\n")}\n`);
}
