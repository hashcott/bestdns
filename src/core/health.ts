import type { DnsProvider } from "../types";
import { randomLabel } from "../util";
import { dohQuery } from "./doh";
import { timedQuery } from "./resolver";

/**
 * Ad / tracker hostnames that ad-blocking resolvers commonly block. The
 * health check reports how many of these fail to resolve.
 */
const AD_DOMAINS = [
  "ad.doubleclick.net",
  "pagead2.googlesyndication.com",
  "secure.adnxs.com",
  "static.ads-twitter.com",
  "analytics.tiktok.com",
];

/** Domain that fails DNSSEC validation — a validating resolver returns SERVFAIL. */
const DNSSEC_FAILURE_DOMAIN = "dnssec-failed.org";

/** Health and capability report for a single provider. */
export interface HealthReport {
  provider: DnsProvider;
  /** Server answered a basic query. */
  reachable: boolean;
  /** True = validates DNSSEC, false = does not, null = inconclusive. */
  dnssec: boolean | null;
  /** True = returns NXDOMAIN correctly, false = hijacks, null = inconclusive. */
  noHijacking: boolean | null;
  /** Number of ad/tracker domains that were blocked. */
  adsBlocked: number;
  /** Number of ad/tracker domains tested. */
  adsTested: number;
  /** DoH endpoint reachable; null = provider has no DoH endpoint. */
  dohReachable: boolean | null;
}

/** True for addresses used to "black-hole" a blocked domain. */
function isBlackhole(ip: string): boolean {
  return ip === "0.0.0.0" || ip === "::" || ip === "0:0:0:0:0:0:0:0";
}

/** Run the full suite of capability checks against a provider. */
export async function checkHealth(provider: DnsProvider, timeoutMs = 3000): Promise<HealthReport> {
  const server = provider.ipv4[0];
  const report: HealthReport = {
    provider,
    reachable: false,
    dnssec: null,
    noHijacking: null,
    adsBlocked: 0,
    adsTested: AD_DOMAINS.length,
    dohReachable: null,
  };

  if (!server) return report;

  // Reachability — a plain query against a well-known domain.
  report.reachable = (await timedQuery(server, "example.com", "A", timeoutMs)).responded;

  if (report.reachable) {
    // DNSSEC — validating resolvers SERVFAIL on a deliberately broken domain.
    const dnssec = await timedQuery(server, DNSSEC_FAILURE_DOMAIN, "A", timeoutMs);
    if (dnssec.code === "SERVFAIL") report.dnssec = true;
    else if (dnssec.code === "OK") report.dnssec = false;

    // NXDOMAIN hijacking — a random name must come back as NXDOMAIN.
    const hijack = await timedQuery(server, `${randomLabel()}.com`, "A", timeoutMs);
    if (hijack.code === "NXDOMAIN") report.noHijacking = true;
    else if (hijack.resolved) report.noHijacking = false;

    // Ad blocking — count tracker domains that fail to resolve.
    for (const domain of AD_DOMAINS) {
      const r = await timedQuery(server, domain, "A", timeoutMs);
      const blocked = r.code === "NXDOMAIN" || (r.resolved && r.addresses.every(isBlackhole));
      if (blocked) report.adsBlocked++;
    }
  }

  // DoH reachability.
  if (provider.doh) {
    report.dohReachable = (await dohQuery(provider.doh, "example.com", timeoutMs + 2000)).ok;
  }

  return report;
}
