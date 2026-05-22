import pc from "picocolors";
import { GROUPS } from "../data/providers";
import type { ProviderGroup } from "../types";

/** Re-exported colour helper so callers need a single import. */
export const c = pc;

/** Accent colour for each provider group. */
const GROUP_COLOR: Record<ProviderGroup, (s: string) => string> = {
  "non-filtering": pc.cyan,
  security: pc.green,
  family: pc.magenta,
};

/** Apply a group's accent colour to `text`. */
export function paintGroup(group: ProviderGroup, text: string): string {
  return GROUP_COLOR[group](text);
}

/** `emoji label` for a group, uncoloured. */
export function groupLabel(group: ProviderGroup): string {
  const meta = GROUPS[group];
  return `${meta.emoji} ${meta.label}`;
}

/** Coloured `emoji label` for a group. */
export function groupTag(group: ProviderGroup): string {
  return paintGroup(group, groupLabel(group));
}

/** Compact header banner shown by non-interactive commands. */
export function banner(version: string): string {
  const title = pc.bold(pc.cyan("⚡ bestdns"));
  const ver = pc.dim(`v${version}`);
  const tagline = pc.dim("Find the fastest, safest DNS for your network");
  return `\n  ${title} ${pc.dim("·")} ${ver}\n  ${tagline}\n`;
}

/** Shared status glyphs. */
export const icons = {
  ok: pc.green("✔"),
  bad: pc.red("✘"),
  warn: pc.yellow("▲"),
  unknown: pc.dim("–"),
  bullet: pc.dim("•"),
  arrow: pc.cyan("➜"),
  star: pc.yellow("★"),
};

/** Render a tri-state boolean (`true` / `false` / `null`) as a glyph. */
export function triState(value: boolean | null): string {
  if (value === null) return icons.unknown;
  return value ? icons.ok : icons.bad;
}
