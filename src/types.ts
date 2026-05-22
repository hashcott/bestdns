/** Shared domain types for the bestdns CLI. */

/**
 * DNS provider categories, mirroring the taxonomy used by the AdGuard
 * knowledge base (https://adguard-dns.io/kb/general/dns-providers/).
 */
export type ProviderGroup = "non-filtering" | "security" | "family";

/** A single DNS provider entry — built-in catalog or user-added. */
export interface DnsProvider {
  /** Stable, unique, kebab-case identifier used on the command line. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Category this provider belongs to. */
  group: ProviderGroup;
  /** IPv4 addresses, primary first. */
  ipv4: string[];
  /** Optional IPv6 addresses, primary first. */
  ipv6?: string[];
  /** Optional DNS-over-HTTPS endpoint URL. */
  doh?: string;
  /** Optional DNS-over-TLS hostname. */
  dot?: string;
  /** Short human description. */
  notes?: string;
  /** True when the entry was added by the user (persisted on disk). */
  custom?: boolean;
}

/** Metadata describing how a provider group is presented in the UI. */
export interface GroupMeta {
  id: ProviderGroup;
  label: string;
  emoji: string;
  description: string;
}
