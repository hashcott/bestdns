import * as p from "@clack/prompts";
import pc from "picocolors";
import { getBackend, pickService } from "../os";
import { latestBackup } from "../store/backups";
import { guard, promptService } from "../ui/prompts";
import { icons } from "../ui/theme";

/** Options for the `restore` command. */
export interface RestoreCommandOptions {
  /** Network service to restore (defaults to the active one). */
  service?: string;
  /** Skip the confirmation prompt. */
  yes?: boolean;
  /** Allow interactive prompts. */
  interactive?: boolean;
}

/**
 * Restore a network service's DNS to automatic (DHCP), or to the settings
 * captured in the most recent backup.
 */
export async function runRestore(options: RestoreCommandOptions = {}): Promise<void> {
  const backend = getBackend();
  if (!backend.supported) {
    p.log.error(backend.unsupportedReason ?? "This platform is not supported.");
    return;
  }

  const services = await backend.listServices();
  if (services.length === 0) {
    p.log.error("No configurable network services were found.");
    return;
  }

  let service = pickService(services, options.service);
  if (options.service && !service) {
    p.log.error(`Unknown network service "${options.service}".`);
    return;
  }
  if (options.interactive && !options.service && services.length > 1) {
    service = await promptService(backend, "Restore which network service?");
  }
  if (!service) {
    p.log.error("Could not determine which network service to use.");
    return;
  }

  const current = await backend.getDns(service);
  const currentLabel =
    current.length > 0 ? pc.cyan(current.join(", ")) : pc.yellow("Automatic (DHCP)");
  p.log.message(`${pc.bold(service.name)} — current DNS: ${currentLabel}`);

  // Decide what to restore to.
  const backup = latestBackup(service.id);
  let mode: "auto" | "backup" = "auto";
  if (options.interactive && backup && backup.servers.length > 0) {
    mode = guard(
      await p.select({
        message: "Restore to…",
        options: [
          { value: "auto", label: "Automatic (DHCP)", hint: "let the network assign DNS" },
          {
            value: "backup",
            label: `Previous setting — ${backup.servers.join(", ")}`,
            hint: new Date(backup.at).toLocaleString(),
          },
        ],
      }),
    ) as "auto" | "backup";
  }

  // Confirm.
  if (!options.yes) {
    if (!options.interactive) {
      p.log.error("Refusing to change DNS without confirmation — re-run with --yes.");
      return;
    }
    const target = mode === "backup" && backup ? backup.servers.join(", ") : "Automatic (DHCP)";
    const confirmed = guard(
      await p.confirm({ message: `Restore ${pc.bold(service.name)} to ${pc.bold(target)}?` }),
    );
    if (!confirmed) {
      p.log.info("No changes were made.");
      return;
    }
  }

  p.log.step("Restoring DNS settings — you may be asked for your password.");
  const result =
    mode === "backup" && backup
      ? await backend.applySet(service, backup.servers)
      : await backend.applyReset(service);

  if (result.ok) {
    p.log.success(`${icons.ok} DNS for ${pc.bold(service.name)} was restored.`);
  } else {
    p.log.error(result.message);
  }
}
