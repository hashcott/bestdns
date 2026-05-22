#!/usr/bin/env node
import * as p from "@clack/prompts";
import updateNotifier from "update-notifier";
import { buildProgram } from "./cli";
import { runInteractiveMenu } from "./menu";
import { canPrompt } from "./ui/prompts";
import { NAME, VERSION } from "./version";

/** Best-effort check for a newer version on npm — never blocks the CLI. */
function checkForUpdates(): void {
  try {
    updateNotifier({
      pkg: { name: NAME, version: VERSION },
      updateCheckInterval: 1000 * 60 * 60 * 24, // once a day
    }).notify({ defer: true });
  } catch {
    /* update checks must never break the tool */
  }
}

async function main(): Promise<void> {
  checkForUpdates();

  const args = process.argv.slice(2);

  // No arguments → interactive menu in a terminal, help otherwise.
  if (args.length === 0) {
    if (canPrompt()) {
      await runInteractiveMenu();
    } else {
      buildProgram().outputHelp();
    }
    return;
  }

  await buildProgram().parseAsync(process.argv);
}

main().catch((error) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
