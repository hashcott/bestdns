import * as p from "@clack/prompts";
import pc from "picocolors";
import { findProvider } from "../catalog";
import { getBackend, pickService } from "../os";
import { addBackup } from "../store/backups";
import { guard, promptProvider, promptService } from "../ui/prompts";
import { icons } from "../ui/theme";

/** Options for the `apply` command. */
export interface ApplyCommandOptions {
  /** Provider id or name to apply. */
  provider?: string;
  /** Network service to target (defaults to the active one). */
  service?: string;
  /** Also configure the provider's IPv6 addresses. */
  ipv6?: boolean;
  /** Print the command without running it. */
  dryRun?: boolean;
  /** Skip the confirmation prompt. */
  yes?: boolean;
  /** Allow interactive prompts for missing input. */
  interactive?: boolean;
}

/**
 * Apply a DNS provider to a network service. The previous DNS configuration
 * is always backed up first so `restore` can undo the change.
 *
 * @returns true when the change was applied (or previewed) successfully.
 */
export async function runApply(options: ApplyCommandOptions = {}): Promise<boolean> {
  const backend = getBackend();
  if (!backend.supported) {
    p.log.error(backend.unsupportedReason ?? "This platform is not supported.");
    return false;
  }

  // ── Resolve the provider ──────────────────────────────────────────────
  let provider = options.provider ? findProvider(options.provider) : undefined;
  if (options.provider && !provider) {
    p.log.error(`Unknown provider "${options.provider}". Run \`bestdns list\` to see all options.`);
    return false;
  }
  if (!provider) {
    if (!options.interactive) {
      p.log.error("No provider given. Usage: bestdns apply <provider>");
      return false;
    }
    provider = await promptProvider("Which DNS provider do you want to apply?");
  }

  // ── Resolve the network service ───────────────────────────────────────
  const services = await backend.listServices();
  if (services.length === 0) {
    p.log.error("No configurable network services were found.");
    return false;
  }
  let service = pickService(services, options.service);
  if (options.service && !service) {
    p.log.error(`Unknown network service "${options.service}".`);
    return false;
  }
  if (options.interactive && !options.service && services.length > 1) {
    service = await promptService(backend, "Apply to which network service?");
  }
  if (!service) {
    p.log.error("Could not determine which network service to use.");
    return false;
  }

  // ── Build the address list ────────────────────────────────────────────
  const servers = [...provider.ipv4];
  if (options.ipv6 && provider.ipv6?.length) servers.push(...provider.ipv6);
  if (servers.length === 0) {
    p.log.error(`Provider "${provider.name}" has no usable addresses.`);
    return false;
  }

  const preview = backend.previewSet(service, servers);

  // ── Dry run ───────────────────────────────────────────────────────────
  if (options.dryRun) {
    p.log.info(
      `Would set DNS for ${pc.bold(service.name)} to ${pc.bold(provider.name)}: ${pc.cyan(
        servers.join(", "),
      )}`,
    );
    p.log.message(pc.dim(`$ ${preview}`));
    return true;
  }

  // ── Confirm ───────────────────────────────────────────────────────────
  if (!options.yes) {
    if (!options.interactive) {
      p.log.error("Refusing to change DNS without confirmation — re-run with --yes.");
      return false;
    }
    const confirmed = guard(
      await p.confirm({
        message:
          `Set DNS of ${pc.bold(service.name)} to ${pc.bold(provider.name)} ` +
          `(${servers.join(", ")})?`,
      }),
    );
    if (!confirmed) {
      p.log.info("No changes were made.");
      return false;
    }
  }

  // ── Back up the current configuration ─────────────────────────────────
  const current = await backend.getDns(service);
  addBackup({
    at: new Date().toISOString(),
    platform: backend.platform,
    service: service.id,
    servers: current,
  });

  // ── Apply (may prompt for elevated privileges) ────────────────────────
  p.log.step("Applying DNS settings — you may be asked for your password.");
  const result = await backend.applySet(service, servers);
  if (!result.ok) {
    p.log.error(result.message);
    return false;
  }

  p.log.success(`${icons.ok} ${pc.bold(provider.name)} applied to ${pc.bold(service.name)}.`);
  const applied = await backend.getDns(service);
  if (applied.length > 0) {
    p.log.message(pc.dim(`Now using: ${applied.join(", ")}`));
  }
  p.log.message(pc.dim("Revert anytime with:  bestdns restore"));
  return true;
}
