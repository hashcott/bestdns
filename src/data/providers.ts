import type { DnsProvider, GroupMeta, ProviderGroup } from "../types";

/**
 * Provider group metadata, ordered for display. The taxonomy follows the
 * AdGuard knowledge base: https://adguard-dns.io/kb/general/dns-providers/
 */
export const GROUPS: Record<ProviderGroup, GroupMeta> = {
  "non-filtering": {
    id: "non-filtering",
    label: "Non-filtering",
    emoji: "🚀",
    description: "Fast, unfiltered resolvers — best raw speed and privacy.",
  },
  security: {
    id: "security",
    label: "Security & Ad-blocking",
    emoji: "🛡️",
    description: "Block ads, trackers, malware and phishing domains.",
  },
  family: {
    id: "family",
    label: "Family-safe",
    emoji: "👨‍👩‍👧",
    description: "Block adult content on top of security filtering.",
  },
};

/** Display order for the three groups. */
export const GROUP_ORDER: ProviderGroup[] = ["non-filtering", "security", "family"];

/**
 * Built-in DNS provider catalog. Addresses are the public, well-known
 * endpoints published by each provider.
 */
export const BUILT_IN_PROVIDERS: DnsProvider[] = [
  // ─── Non-filtering ────────────────────────────────────────────────────
  {
    id: "cloudflare",
    name: "Cloudflare",
    group: "non-filtering",
    ipv4: ["1.1.1.1", "1.0.0.1"],
    ipv6: ["2606:4700:4700::1111", "2606:4700:4700::1001"],
    doh: "https://cloudflare-dns.com/dns-query",
    dot: "one.one.one.one",
    notes: "Fast, privacy-first, no filtering.",
  },
  {
    id: "google",
    name: "Google Public DNS",
    group: "non-filtering",
    ipv4: ["8.8.8.8", "8.8.4.4"],
    ipv6: ["2001:4860:4860::8888", "2001:4860:4860::8844"],
    doh: "https://dns.google/dns-query",
    dot: "dns.google",
    notes: "Global anycast network, very reliable.",
  },
  {
    id: "quad9-unfiltered",
    name: "Quad9 (Unfiltered)",
    group: "non-filtering",
    ipv4: ["9.9.9.10", "149.112.112.10"],
    ipv6: ["2620:fe::10", "2620:fe::fe:10"],
    doh: "https://dns10.quad9.net/dns-query",
    dot: "dns10.quad9.net",
    notes: "Quad9 without the security blocklist.",
  },
  {
    id: "opendns",
    name: "OpenDNS (Cisco)",
    group: "non-filtering",
    ipv4: ["208.67.222.222", "208.67.220.220"],
    ipv6: ["2620:119:35::35", "2620:119:53::53"],
    doh: "https://doh.opendns.com/dns-query",
    notes: "Standard OpenDNS resolver.",
  },
  {
    id: "adguard-unfiltered",
    name: "AdGuard DNS (Non-filtering)",
    group: "non-filtering",
    ipv4: ["94.140.14.140", "94.140.14.141"],
    ipv6: ["2a10:50c0::1:ff", "2a10:50c0::2:ff"],
    doh: "https://dns-unfiltered.adguard.com/dns-query",
    dot: "unfiltered.adguard-dns.com",
    notes: "AdGuard resolver with no ad/tracker filtering.",
  },

  // ─── Security & Ad-blocking ───────────────────────────────────────────
  {
    id: "adguard",
    name: "AdGuard DNS (Default)",
    group: "security",
    ipv4: ["94.140.14.14", "94.140.15.15"],
    ipv6: ["2a10:50c0::ad1:ff", "2a10:50c0::ad2:ff"],
    doh: "https://dns.adguard-dns.com/dns-query",
    dot: "dns.adguard-dns.com",
    notes: "Blocks ads & trackers.",
  },
  {
    id: "cloudflare-security",
    name: "Cloudflare (Malware Blocking)",
    group: "security",
    ipv4: ["1.1.1.2", "1.0.0.2"],
    ipv6: ["2606:4700:4700::1112", "2606:4700:4700::1002"],
    doh: "https://security.cloudflare-dns.com/dns-query",
    dot: "security.cloudflare-dns.com",
    notes: "Blocks malware domains.",
  },
  {
    id: "quad9",
    name: "Quad9",
    group: "security",
    ipv4: ["9.9.9.9", "149.112.112.112"],
    ipv6: ["2620:fe::fe", "2620:fe::9"],
    doh: "https://dns.quad9.net/dns-query",
    dot: "dns.quad9.net",
    notes: "Blocks malware & phishing, enforces DNSSEC.",
  },
  {
    id: "cleanbrowsing-security",
    name: "CleanBrowsing (Security)",
    group: "security",
    ipv4: ["185.228.168.9", "185.228.169.9"],
    ipv6: ["2a0d:2a00:1::2", "2a0d:2a00:2::2"],
    doh: "https://doh.cleanbrowsing.org/doh/security-filter/",
    dot: "security-filter-dns.cleanbrowsing.org",
    notes: "Blocks malicious and compromised domains.",
  },
  {
    id: "mullvad-adblock",
    name: "Mullvad (Ad-blocking)",
    group: "security",
    ipv4: ["194.242.2.3"],
    ipv6: ["2a07:e340::3"],
    doh: "https://adblock.dns.mullvad.net/dns-query",
    dot: "adblock.dns.mullvad.net",
    notes: "Privacy-focused, blocks ads & trackers.",
  },
  {
    id: "controld-malware",
    name: "Control D (Malware + Ads)",
    group: "security",
    ipv4: ["76.76.2.2", "76.76.10.2"],
    doh: "https://freedns.controld.com/p2",
    dot: "p2.freedns.controld.com",
    notes: "Blocks malware and advertising.",
  },
  {
    id: "dns0",
    name: "DNS0.eu",
    group: "security",
    ipv4: ["193.110.81.0", "185.253.5.0"],
    ipv6: ["2a0f:fc80::", "2a0f:fc81::"],
    doh: "https://dns0.eu",
    dot: "dns0.eu",
    notes: "European resolver, blocks malware.",
  },

  // ─── Family-safe ──────────────────────────────────────────────────────
  {
    id: "adguard-family",
    name: "AdGuard DNS (Family Protection)",
    group: "family",
    ipv4: ["94.140.14.15", "94.140.15.16"],
    ipv6: ["2a10:50c0::bad1:ff", "2a10:50c0::bad2:ff"],
    doh: "https://family.adguard-dns.com/dns-query",
    dot: "family.adguard-dns.com",
    notes: "Blocks adult content on top of ads & trackers.",
  },
  {
    id: "cloudflare-family",
    name: "Cloudflare for Families",
    group: "family",
    ipv4: ["1.1.1.3", "1.0.0.3"],
    ipv6: ["2606:4700:4700::1113", "2606:4700:4700::1003"],
    doh: "https://family.cloudflare-dns.com/dns-query",
    dot: "family.cloudflare-dns.com",
    notes: "Blocks malware and adult content.",
  },
  {
    id: "cleanbrowsing-family",
    name: "CleanBrowsing (Family)",
    group: "family",
    ipv4: ["185.228.168.168", "185.228.169.168"],
    ipv6: ["2a0d:2a00:1::", "2a0d:2a00:2::"],
    doh: "https://doh.cleanbrowsing.org/doh/family-filter/",
    dot: "family-filter-dns.cleanbrowsing.org",
    notes: "Blocks adult content and mixed-content sites.",
  },
  {
    id: "opendns-family",
    name: "OpenDNS FamilyShield",
    group: "family",
    ipv4: ["208.67.222.123", "208.67.220.123"],
    notes: "Pre-configured to block adult content.",
  },
];
