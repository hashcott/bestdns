/** Severity bucket for diagnostic findings. */
export type Severity = "ok" | "info" | "warning" | "issue";

/** Stable identifier for an automatic fix `bestdns` can perform. */
export type FixId = "swap-dns" | "flush-dns-cache" | "restart-mdns";

/** A single observation produced by `diagnose`. */
export interface Finding {
  /** Stable id used by `optimize` to match fixes to findings. */
  id: string;
  /** Short headline shown in the report. */
  title: string;
  severity: Severity;
  /** Longer one-line explanation. */
  detail: string;
  /** When true, `optimize` will offer to fix it. */
  fixable?: boolean;
  /** Slug identifying which built-in fix to run. */
  fixId?: FixId;
  /** Manual suggestion shown when there's no automatic fix. */
  suggestion?: string;
}

/** Outcome of a single `ping` invocation. */
export interface PingResult {
  ok: boolean;
  lossPct: number;
  avgMs: number | null;
  packetsSent: number;
  packetsReceived: number;
  /** Raw command output, retained for debugging. */
  raw: string;
}

/** Latency probe to a single named target. */
export interface LatencyResult {
  target: string;
  ping: PingResult;
}

/** Throughput measurement against a download endpoint. */
export interface SpeedtestResult {
  ok: boolean;
  downloadMbps: number;
  bytesTransferred: number;
  durationMs: number;
  error?: string;
}

/** Largest IP packet size that survives the path without fragmentation. */
export interface MtuResult {
  pathMtu: number | null;
  triedSizes: number[];
  available: boolean;
  error?: string;
}

/** Wi-Fi link details, best-effort per platform. */
export interface WifiInfo {
  available: boolean;
  connected: boolean;
  ssid?: string;
  signalDbm?: number;
  noiseDbm?: number;
  channel?: string;
  rxRateMbps?: number;
  txRateMbps?: number;
  /** Falls back to raw OS text when structured parsing failed. */
  raw?: string;
}

/** Bundle of measurements taken at one point in time. */
export interface NetworkSnapshot {
  takenAt: string;
  speedtest: SpeedtestResult;
  latency: LatencyResult[];
  packetLoss: PingResult;
  mtu: MtuResult;
  wifi: WifiInfo;
  currentDns: string[];
  currentDnsAvgMs: number | null;
}

/** Output of the full diagnose flow. */
export interface DiagnoseReport {
  snapshot: NetworkSnapshot;
  findings: Finding[];
}
