/** Types shared by the per-platform DNS backends. */

/** A configurable network service / interface. */
export interface NetworkService {
  /** Identifier the backend uses to target this service. */
  id: string;
  /** Human-readable label. */
  name: string;
  /** True when this service carries the default route. */
  active: boolean;
  /** Backend-private data (Linux device name, Windows interface index, …). */
  extra?: Record<string, string>;
}

/** Outcome of applying or resetting DNS settings. */
export interface ApplyResult {
  ok: boolean;
  /** Human-readable status message. */
  message: string;
  /** The command that was executed, shown to the user for transparency. */
  command: string;
}

/** A per-platform implementation of reading and writing DNS settings. */
export interface DnsBackend {
  /** `process.platform` value this backend handles. */
  readonly platform: string;
  /** False when the platform/toolchain is not usable. */
  readonly supported: boolean;
  /** Explanation shown when `supported` is false. */
  readonly unsupportedReason?: string;
  /** List configurable network services. */
  listServices(): Promise<NetworkService[]>;
  /** Read configured DNS servers — an empty array means automatic / DHCP. */
  getDns(service: NetworkService): Promise<string[]>;
  /** Human preview of the "set DNS" command (for `--dry-run`). */
  previewSet(service: NetworkService, servers: string[]): string;
  /** Human preview of the "reset DNS" command (for `--dry-run`). */
  previewReset(service: NetworkService): string;
  /** Apply DNS servers, elevating privileges if required. */
  applySet(service: NetworkService, servers: string[]): Promise<ApplyResult>;
  /** Reset DNS to automatic / DHCP, elevating privileges if required. */
  applyReset(service: NetworkService): Promise<ApplyResult>;
}
