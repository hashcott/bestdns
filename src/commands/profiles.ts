import * as p from "@clack/prompts";
import Table from "cli-table3";
import pc from "picocolors";
import { type NetworkProfile, listProfiles, removeProfile } from "../core/network/profiles";
import { guard } from "../ui/prompts";
import { icons } from "../ui/theme";

/** Sub-actions of the `profiles` command. */
export type ProfilesAction = "list" | "prune" | "remove";

/** Options for the `profiles` command. */
export interface ProfilesCommandOptions {
  /** Profile name (used by `remove`). */
  name?: string;
  /** Emit JSON for `list`. */
  json?: boolean;
  /** Allow interactive prompts. */
  interactive?: boolean;
}

/** Friendly label for a profile category. */
function kindLabel(kind: NetworkProfile["kind"]): string {
  switch (kind) {
    case "wifi":
      return "Wi-Fi network";
    case "location":
      return "Network location";
    case "connection":
      return "NM connection";
  }
}

/** Render the profile list as a grouped table. */
function renderProfilesTable(profiles: NetworkProfile[]): string {
  const table = new Table({
    head: [pc.bold("Kind"), pc.bold("Name"), pc.bold("Detail"), pc.bold("Status")],
    style: { head: [], border: [] },
  });
  for (const profile of profiles) {
    table.push([
      kindLabel(profile.kind),
      profile.name,
      profile.detail ?? pc.dim("—"),
      profile.active ? pc.green("active") : pc.dim("saved"),
    ]);
  }
  return table.toString();
}

/** Print the full saved-profile list. */
async function showList(options: ProfilesCommandOptions): Promise<void> {
  const spin = options.json ? null : p.spinner();
  spin?.start("Listing saved network profiles…");
  const result = await listProfiles();
  spin?.stop(`Found ${result.profiles.length} profile(s) via ${result.mechanism}.`);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (!result.ok) {
    p.log.error(result.notes ?? "Could not list profiles on this system.");
    return;
  }
  if (result.profiles.length === 0) {
    p.log.info("No saved profiles found.");
    return;
  }

  process.stdout.write(`\n${renderProfilesTable(result.profiles)}\n\n`);
  if (result.notes) p.log.message(pc.dim(result.notes));
  p.log.message(
    pc.dim(
      "Prune stale ones interactively with  bestdns profiles prune,  or remove a single entry with  bestdns profiles remove <name>",
    ),
  );
}

/** Remove a single profile by name (or via a picker when no name is given). */
async function removeOne(options: ProfilesCommandOptions): Promise<void> {
  const result = await listProfiles();
  if (!result.ok) {
    p.log.error(result.notes ?? "Could not list profiles.");
    return;
  }
  if (result.profiles.length === 0) {
    p.log.info("No profiles to remove.");
    return;
  }

  let profile = options.name
    ? result.profiles.find((entry) => entry.name === options.name)
    : undefined;

  if (options.name && !profile) {
    p.log.error(`No saved profile called "${options.name}".`);
    return;
  }

  if (!profile) {
    if (!options.interactive) {
      p.log.error("Specify a profile name: bestdns profiles remove <name>");
      return;
    }
    const name = guard(
      await p.select({
        message: "Remove which profile?",
        options: result.profiles.map((entry) => ({
          value: entry.name,
          label: `${kindLabel(entry.kind)} · ${entry.name}`,
          hint: entry.active ? "active — proceed with care" : entry.detail,
        })),
      }),
    );
    profile = result.profiles.find((entry) => entry.name === name) as NetworkProfile;
  }

  if (profile.active) {
    const ok = guard(
      await p.confirm({
        message: `"${profile.name}" is currently active. Remove anyway?`,
        initialValue: false,
      }),
    );
    if (!ok) {
      p.log.info("Cancelled.");
      return;
    }
  }

  p.log.step(`Removing ${kindLabel(profile.kind)} "${profile.name}"…`);
  const outcome = await removeProfile(profile);
  if (outcome.ok) p.log.success(`${icons.ok} ${outcome.message}`);
  else p.log.error(outcome.message);
}

/** Interactive bulk cleanup: pick several stale profiles, confirm, remove all. */
async function pruneInteractive(options: ProfilesCommandOptions): Promise<void> {
  if (!options.interactive) {
    p.log.error("`profiles prune` is interactive — run from a terminal.");
    return;
  }

  const result = await listProfiles();
  if (!result.ok) {
    p.log.error(result.notes ?? "Could not list profiles.");
    return;
  }

  // Active profiles are excluded from the picker so they can't be removed
  // accidentally — use `profiles remove <name>` to do that explicitly.
  const candidates = result.profiles.filter((entry) => !entry.active);
  if (candidates.length === 0) {
    p.log.info("Nothing to prune — every saved profile is currently active.");
    return;
  }

  const selected = guard(
    await p.multiselect({
      message: "Select profiles to remove (space to toggle, enter to confirm)",
      required: false,
      options: candidates.map((entry) => ({
        value: entry.name,
        label: `${kindLabel(entry.kind)} · ${entry.name}`,
        hint: entry.detail,
      })),
    }),
  ) as string[];

  if (selected.length === 0) {
    p.log.info("Nothing selected — no changes made.");
    return;
  }

  const confirmed = guard(
    await p.confirm({
      message: `Remove ${selected.length} profile(s)? You may be asked for your password.`,
    }),
  );
  if (!confirmed) {
    p.log.info("Cancelled.");
    return;
  }

  let removed = 0;
  for (const name of selected) {
    const profile = candidates.find((entry) => entry.name === name);
    if (!profile) continue;
    const outcome = await removeProfile(profile);
    if (outcome.ok) {
      p.log.success(`${icons.ok} ${outcome.message}`);
      removed += 1;
    } else {
      p.log.error(outcome.message);
    }
  }
  p.log.message(pc.dim(`Removed ${removed} of ${selected.length} selected profile(s).`));
}

/** Entry point for the `profiles` command and its sub-actions. */
export async function runProfiles(
  action: ProfilesAction,
  options: ProfilesCommandOptions = {},
): Promise<void> {
  switch (action) {
    case "list":
      await showList(options);
      return;
    case "remove":
      await removeOne(options);
      return;
    case "prune":
      await pruneInteractive(options);
      return;
  }
}
