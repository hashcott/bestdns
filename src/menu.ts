import * as p from "@clack/prompts";
import { runApply } from "./commands/apply";
import { runAuto } from "./commands/auto";
import { runBenchmark } from "./commands/benchmark";
import { runCurrent } from "./commands/current";
import { runDiagnose } from "./commands/diagnose";
import { runHealth } from "./commands/health";
import { runHogs } from "./commands/hogs";
import { type ListAction, runList } from "./commands/list";
import { runOptimize } from "./commands/optimize";
import { type ProfilesAction, runProfiles } from "./commands/profiles";
import { runRestore } from "./commands/restore";
import { guard } from "./ui/prompts";
import { c } from "./ui/theme";
import { VERSION } from "./version";

/** Sub-menu for managing saved network profiles. */
async function profilesMenu(): Promise<void> {
  const action = guard(
    await p.select<ProfilesAction>({
      message: "Manage saved network profiles",
      options: [
        { value: "list", label: "📖 List every saved profile" },
        { value: "prune", label: "🧹 Prune stale profiles (multi-select)" },
        { value: "remove", label: "🗑  Remove a single profile" },
      ],
    }),
  );
  await runProfiles(action, { interactive: true });
}

/** Sub-menu for managing the provider catalog. */
async function listMenu(): Promise<void> {
  const action = guard(
    await p.select<ListAction>({
      message: "Manage provider list",
      options: [
        { value: "show", label: "📖 View all providers" },
        { value: "groups", label: "🗂  View categories" },
        { value: "add", label: "➕ Add a custom provider" },
        { value: "remove", label: "🗑  Remove a custom provider" },
      ],
    }),
  );
  await runList(action, { interactive: true });
}

/**
 * Interactive, menu-driven mode — shown when `bestdns` is run with no
 * arguments in a terminal.
 */
export async function runInteractiveMenu(): Promise<void> {
  p.intro(`${c.bgCyan(c.black(" ⚡ bestdns "))} ${c.dim(`v${VERSION}`)}`);
  p.note("Find the fastest, safest DNS for your network — then apply it in one step.", "Welcome");

  let running = true;
  while (running) {
    const action = guard(
      await p.select({
        message: "What would you like to do?",
        options: [
          { value: "auto", label: "⚡ Auto — benchmark & apply the fastest", hint: "recommended" },
          { value: "optimize", label: "🛠  Optimize network — diagnose, fix, re-test" },
          { value: "diagnose", label: "🔬 Diagnose network — read-only report" },
          { value: "hogs", label: "🐷 Top network-hungry processes" },
          { value: "benchmark", label: "🔍 Benchmark DNS providers" },
          { value: "current", label: "📡 Show current DNS" },
          { value: "apply", label: "🎯 Apply a DNS provider" },
          { value: "health", label: "🩺 Health & capability check" },
          { value: "list", label: "📋 Manage provider list" },
          { value: "profiles", label: "🧹 Manage saved network profiles" },
          { value: "restore", label: "↩️  Restore DNS to automatic" },
          { value: "exit", label: "👋 Exit" },
        ],
      }),
    );

    switch (action) {
      case "auto":
        await runAuto({ interactive: true });
        break;
      case "optimize":
        await runOptimize({ interactive: true });
        break;
      case "diagnose":
        await runDiagnose();
        break;
      case "hogs":
        await runHogs();
        break;
      case "benchmark":
        await runBenchmark({ interactive: true });
        break;
      case "current":
        await runCurrent();
        break;
      case "apply":
        await runApply({ interactive: true });
        break;
      case "health":
        await runHealth({ interactive: true });
        break;
      case "list":
        await listMenu();
        break;
      case "profiles":
        await profilesMenu();
        break;
      case "restore":
        await runRestore({ interactive: true });
        break;
      case "exit":
        running = false;
        break;
    }

    if (running) {
      running = guard(await p.confirm({ message: "Back to the main menu?", initialValue: true }));
    }
  }

  p.outro(c.dim("Thanks for using bestdns 🌐"));
}
