import { Command, InvalidArgumentError } from "commander";
import { runApply } from "./commands/apply";
import { runAuto } from "./commands/auto";
import { runBenchmark } from "./commands/benchmark";
import { runCurrent } from "./commands/current";
import { runDiagnose } from "./commands/diagnose";
import { runHealth } from "./commands/health";
import { runList } from "./commands/list";
import { runOptimize } from "./commands/optimize";
import { runRestore } from "./commands/restore";
import { runInteractiveMenu } from "./menu";
import type { ProviderGroup } from "./types";
import { canPrompt } from "./ui/prompts";
import { DESCRIPTION, VERSION } from "./version";

/** Commander option parser: validate a provider category. */
function parseGroup(value: string): ProviderGroup | "all" {
  const normalised = value.trim().toLowerCase();
  if (
    normalised === "all" ||
    normalised === "non-filtering" ||
    normalised === "security" ||
    normalised === "family"
  ) {
    return normalised as ProviderGroup | "all";
  }
  throw new InvalidArgumentError("Choose one of: all, non-filtering, security, family.");
}

/** Commander option parser: validate a positive integer. */
function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("Expected a positive integer.");
  }
  return parsed;
}

/** Build the full Commander program (subcommands + flags). */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("bestdns")
    .description(DESCRIPTION)
    .version(VERSION, "-v, --version", "show the version number")
    .showHelpAfterError("(run `bestdns --help` for usage)");

  program
    .command("menu")
    .description("open the interactive menu")
    .action(async () => {
      await runInteractiveMenu();
    });

  program
    .command("auto")
    .description("benchmark every provider and apply the fastest in one step")
    .option("-g, --group <category>", "limit to a category", parseGroup)
    .option("--ipv6", "also configure IPv6 addresses")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (opts) => {
      await runAuto({
        group: opts.group,
        ipv6: opts.ipv6,
        yes: opts.yes,
        interactive: canPrompt(),
      });
    });

  program
    .command("benchmark")
    .alias("bench")
    .description("benchmark DNS providers and rank them by speed")
    .option("-g, --group <category>", "limit to a category", parseGroup)
    .option("-r, --rounds <n>", "measured rounds per provider (default 5)", parsePositiveInt)
    .option("-t, --top <n>", "show only the fastest N providers", parsePositiveInt)
    .option("--json", "output machine-readable JSON")
    .action(async (opts) => {
      await runBenchmark({
        group: opts.group,
        rounds: opts.rounds,
        top: opts.top,
        json: opts.json,
      });
    });

  program
    .command("apply")
    .argument("[provider]", "provider id or name (e.g. cloudflare)")
    .description("apply a DNS provider to your network")
    .option("-s, --service <name>", "target a specific network service")
    .option("--ipv6", "also configure IPv6 addresses")
    .option("--dry-run", "print the command without running it")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (provider, opts) => {
      await runApply({
        provider,
        service: opts.service,
        ipv6: opts.ipv6,
        dryRun: opts.dryRun,
        yes: opts.yes,
        interactive: canPrompt(),
      });
    });

  program
    .command("current")
    .alias("status")
    .description("show the current DNS configuration")
    .option("--json", "output machine-readable JSON")
    .action(async (opts) => {
      await runCurrent({ json: opts.json });
    });

  program
    .command("health")
    .argument("[provider]", "inspect a single provider in detail")
    .description("check DNSSEC, NXDOMAIN hijacking, ad-blocking and DoH")
    .option("-g, --group <category>", "limit a multi-provider scan to a category", parseGroup)
    .option("--json", "output machine-readable JSON")
    .action(async (provider, opts) => {
      await runHealth({
        provider,
        group: opts.group,
        json: opts.json,
        interactive: canPrompt(),
      });
    });

  program
    .command("restore")
    .description("restore DNS to automatic (DHCP)")
    .option("-s, --service <name>", "target a specific network service")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (opts) => {
      await runRestore({ service: opts.service, yes: opts.yes, interactive: canPrompt() });
    });

  program
    .command("diagnose")
    .alias("doctor")
    .description("diagnose the network: speed, latency, packet loss, MTU, Wi-Fi, DNS")
    .option("--no-speedtest", "skip the download speedtest")
    .option("--no-mtu", "skip the path-MTU probe")
    .option("--json", "output machine-readable JSON")
    .action(async (opts) => {
      await runDiagnose({
        noSpeedtest: opts.speedtest === false,
        noMtu: opts.mtu === false,
        json: opts.json,
      });
    });

  program
    .command("optimize")
    .alias("optimise")
    .description("diagnose, apply auto-fixes, then re-test (before/after)")
    .option("--no-speedtest", "skip the download speedtest (both snapshots)")
    .option("--no-mtu", "skip the path-MTU probe")
    .option("--no-retest", "skip the second snapshot")
    .option("-y, --yes", "apply every offered fix without confirming")
    .action(async (opts) => {
      await runOptimize({
        noSpeedtest: opts.speedtest === false,
        noMtu: opts.mtu === false,
        noRetest: opts.retest === false,
        yes: opts.yes,
        interactive: canPrompt(),
      });
    });

  const list = program.command("list").description("manage the DNS provider catalog");
  list
    .command("show", { isDefault: true })
    .description("show every provider")
    .action(async () => {
      await runList("show");
    });
  list
    .command("groups")
    .description("show provider categories")
    .action(async () => {
      await runList("groups");
    });
  list
    .command("add")
    .description("add a custom provider (interactive)")
    .action(async () => {
      await runList("add", { interactive: canPrompt() });
    });
  list
    .command("remove")
    .argument("[id]", "id of the custom provider to remove")
    .description("remove a custom provider")
    .action(async (id) => {
      await runList("remove", { id, interactive: canPrompt() });
    });

  program.addHelpText(
    "after",
    `
Examples:
  $ bestdns                       open the interactive menu
  $ bestdns auto                  benchmark and apply the fastest DNS
  $ bestdns benchmark -g security rank ad-blocking providers
  $ bestdns apply cloudflare      apply Cloudflare DNS
  $ bestdns current               show the active DNS
  $ bestdns diagnose              full network diagnostic (speed, MTU, Wi-Fi, DNS)
  $ bestdns optimize              diagnose, apply fixes, then re-test before/after
  $ bestdns health quad9          capability check for one provider
  $ bestdns restore               revert to automatic (DHCP)
`,
  );

  return program;
}
