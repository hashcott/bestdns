import * as p from "@clack/prompts";
import Table from "cli-table3";
import pc from "picocolors";
import { type HogsResult, listHogs } from "../core/network/hogs";

/** Options for the `hogs` command. */
export interface HogsCommandOptions {
  /** Show only the top N processes (default 10). */
  top?: number;
  /** Emit machine-readable JSON. */
  json?: boolean;
}

/** Format bytes as KB / MB / GB. */
function humanBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Render the hogs list as a sorted table. */
function renderHogsTable(result: HogsResult): string {
  const hasBytes = result.hogs.some((h) => h.bytesIn !== undefined || h.bytesOut !== undefined);
  const hasConns = result.hogs.some((h) => h.connections !== undefined);

  const head = hasBytes
    ? [pc.bold("PID"), pc.bold("Process"), pc.bold("Recv"), pc.bold("Sent"), pc.bold("Total")]
    : [pc.bold("PID"), pc.bold("Process"), pc.bold("Connections")];

  const table = new Table({ head, style: { head: [], border: [] } });

  for (const hog of result.hogs) {
    const pid = hog.pid !== undefined ? String(hog.pid) : pc.dim("—");
    if (hasBytes) {
      const inBytes = hog.bytesIn ?? 0;
      const outBytes = hog.bytesOut ?? 0;
      const total = inBytes + outBytes;
      table.push([
        pid,
        hog.process,
        pc.cyan(humanBytes(inBytes)),
        pc.green(humanBytes(outBytes)),
        pc.bold(humanBytes(total)),
      ]);
    } else if (hasConns) {
      table.push([pid, hog.process, pc.cyan(String(hog.connections ?? 0))]);
    }
  }
  return table.toString();
}

/** List network-hungry processes — informational only, never kills anything. */
export async function runHogs(options: HogsCommandOptions = {}): Promise<void> {
  const topN = options.top && options.top > 0 ? options.top : 10;

  const spin = options.json ? null : p.spinner();
  spin?.start("Inspecting network traffic per process…");
  const result = await listHogs(topN);
  spin?.stop(`Scanned ${result.hogs.length} processes (${result.mechanism}).`);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (!result.ok || result.hogs.length === 0) {
    p.log.warn(result.notes ?? "No network-active processes found.");
    return;
  }

  process.stdout.write(`\n${renderHogsTable(result)}\n\n`);
  if (result.notes) p.log.message(pc.dim(result.notes));
  p.log.message(
    pc.dim("bestdns never kills processes. Inspect with Activity Monitor / Task Manager / `htop`,"),
  );
  p.log.message(
    pc.dim("or end one yourself with `kill <PID>` (POSIX) or `Stop-Process -Id <PID>` (Windows)."),
  );
}
