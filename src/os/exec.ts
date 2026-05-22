import { execFile, spawn } from "node:child_process";

/** Result of a non-interactive command execution. */
export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
  ok: boolean;
}

/** Run a command and capture its output. Never rejects. */
export function run(cmd: string, args: string[], timeout = 15000): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const errCode = (err as NodeJS.ErrnoException | null)?.code;
        const code = typeof errCode === "number" ? errCode : err ? 1 : 0;
        resolve({
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          code,
          ok: !err,
        });
      },
    );
  });
}

/**
 * Run a command with inherited stdio so interactive prompts work — used for
 * `sudo` password entry and Windows UAC. Resolves with the exit code.
 */
export function runInteractive(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", windowsHide: true });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(127));
  });
}

/** True when the current process is running as root (POSIX only). */
export function isRoot(): boolean {
  return typeof process.getuid === "function" && process.getuid() === 0;
}
