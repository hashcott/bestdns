import { isRoot, run, runInteractive } from "./exec";

/** Outcome of a network operation, surfaced to the UI layer. */
export interface NetOpResult {
  ok: boolean;
  /** Human-friendly status message. */
  message: string;
  /** The exact command(s) that ran, for the transparency log. */
  command: string;
}

/** Run a single command, elevating with `sudo` if we're not already root. */
async function runMaybeSudo(cmd: string, args: string[], preview: string): Promise<NetOpResult> {
  if (isRoot()) {
    const result = await run(cmd, args);
    return {
      ok: result.ok,
      command: preview,
      message: result.ok ? "Done." : result.stderr || result.stdout || "Command failed.",
    };
  }
  const code = await runInteractive("sudo", [cmd, ...args]);
  return {
    ok: code === 0,
    command: `sudo ${preview}`,
    message: code === 0 ? "Done." : "Command failed or was cancelled.",
  };
}

/**
 * Flush the operating system's DNS cache. Cheap, safe and surprisingly
 * often the right answer to "why is one site loading the old IP?".
 */
export async function flushDnsCache(): Promise<NetOpResult> {
  switch (process.platform) {
    case "darwin": {
      // Modern macOS requires both the cache flush and a SIGHUP to the
      // mDNS daemon for the change to take effect immediately.
      const preview = "dscacheutil -flushcache && killall -HUP mDNSResponder";
      if (isRoot()) {
        const a = await run("dscacheutil", ["-flushcache"]);
        const b = await run("killall", ["-HUP", "mDNSResponder"]);
        const ok = a.ok && b.ok;
        return {
          ok,
          command: preview,
          message: ok ? "DNS cache flushed." : "One of the commands failed.",
        };
      }
      const code = await runInteractive("sudo", [
        "sh",
        "-c",
        "dscacheutil -flushcache && killall -HUP mDNSResponder",
      ]);
      return {
        ok: code === 0,
        command: `sudo ${preview}`,
        message: code === 0 ? "DNS cache flushed." : "Cancelled or failed.",
      };
    }

    case "linux": {
      // Best-effort: try systemd-resolved first, fall back to nscd.
      const resolvectl = await run("resolvectl", ["--version"]);
      if (resolvectl.ok) {
        return runMaybeSudo("resolvectl", ["flush-caches"], "resolvectl flush-caches");
      }
      const nscd = await run("nscd", ["--help"]);
      if (nscd.ok) {
        return runMaybeSudo("nscd", ["-i", "hosts"], "nscd -i hosts");
      }
      return {
        ok: false,
        command: "",
        message: "No supported DNS cache daemon found (tried resolvectl, nscd). Skipped.",
      };
    }

    case "win32": {
      // `ipconfig /flushdns` does not require elevation on modern Windows.
      const res = await run("ipconfig.exe", ["/flushdns"]);
      return {
        ok: res.ok,
        command: "ipconfig /flushdns",
        message: res.ok ? "DNS cache flushed." : res.stdout || res.stderr || "Command failed.",
      };
    }

    default:
      return {
        ok: false,
        command: "",
        message: `Flushing the DNS cache is not implemented for ${process.platform}.`,
      };
  }
}

/**
 * Restart macOS's mDNSResponder daemon. Useful when local discovery (`.local`
 * hostnames, AirPlay, printers) gets stuck. No-op on other platforms.
 */
export async function restartMdns(): Promise<NetOpResult> {
  if (process.platform !== "darwin") {
    return {
      ok: false,
      command: "",
      message: "Restarting mDNS is only supported on macOS.",
    };
  }
  const preview = "launchctl kickstart -k system/com.apple.mDNSResponder";
  if (isRoot()) {
    const res = await run("launchctl", ["kickstart", "-k", "system/com.apple.mDNSResponder"]);
    return {
      ok: res.ok,
      command: preview,
      message: res.ok ? "mDNSResponder restarted." : res.stderr || "Command failed.",
    };
  }
  const code = await runInteractive("sudo", [
    "launchctl",
    "kickstart",
    "-k",
    "system/com.apple.mDNSResponder",
  ]);
  return {
    ok: code === 0,
    command: `sudo ${preview}`,
    message: code === 0 ? "mDNSResponder restarted." : "Cancelled or failed.",
  };
}
