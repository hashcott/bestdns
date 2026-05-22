import { linuxBackend } from "./linux";
import { macosBackend } from "./macos";
import type { ApplyResult, DnsBackend, NetworkService } from "./types";
import { windowsBackend } from "./windows";

export type { ApplyResult, DnsBackend, NetworkService } from "./types";

/** Stand-in backend for platforms bestdns cannot manage. */
function unsupportedBackend(): DnsBackend {
  const reason = `Platform "${process.platform}" is not supported — bestdns manages DNS on macOS, Linux and Windows.`;
  const fail = (): Promise<ApplyResult> =>
    Promise.resolve({ ok: false, command: "", message: reason });
  return {
    platform: process.platform,
    supported: false,
    unsupportedReason: reason,
    listServices: () => Promise.resolve([]),
    getDns: () => Promise.resolve([]),
    previewSet: () => "",
    previewReset: () => "",
    applySet: fail,
    applyReset: fail,
  };
}

/** The DNS backend for the current operating system. */
export function getBackend(): DnsBackend {
  switch (process.platform) {
    case "darwin":
      return macosBackend;
    case "linux":
      return linuxBackend;
    case "win32":
      return windowsBackend;
    default:
      return unsupportedBackend();
  }
}

/**
 * Resolve a network service by name/id, falling back to the active service
 * (the one carrying the default route), then the first available one.
 */
export function pickService(
  services: NetworkService[],
  query?: string,
): NetworkService | undefined {
  if (query) {
    const q = query.trim().toLowerCase();
    return services.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q);
  }
  return services.find((s) => s.active) ?? services[0];
}
