import { Resolver } from "node:dns";

/** Normalised DNS result codes used across bestdns. */
export type QueryCode =
  | "OK"
  | "NXDOMAIN"
  | "NODATA"
  | "SERVFAIL"
  | "REFUSED"
  | "TIMEOUT"
  | "CONNREFUSED"
  | "CANCELLED"
  | "ERROR";

/** Outcome of a single timed DNS query. */
export interface QueryOutcome {
  /** Server produced a DNS answer — including negative ones (NXDOMAIN…). */
  responded: boolean;
  /** Server returned actual address records. */
  resolved: boolean;
  /** Round-trip time in milliseconds. */
  ms: number;
  /** Normalised result code. */
  code: QueryCode;
  /** Resolved addresses, when `resolved` is true. */
  addresses: string[];
}

/** Map a Node DNS error code to a normalised code + "did the server reply" flag. */
function classify(errCode: string | undefined): { code: QueryCode; responded: boolean } {
  switch (errCode) {
    case undefined:
      return { code: "OK", responded: true };
    case "ENOTFOUND":
      return { code: "NXDOMAIN", responded: true };
    case "ENODATA":
      return { code: "NODATA", responded: true };
    case "ESERVFAIL":
      return { code: "SERVFAIL", responded: true };
    case "EREFUSED":
      return { code: "REFUSED", responded: true };
    case "ETIMEOUT":
      return { code: "TIMEOUT", responded: false };
    case "ECONNREFUSED":
      return { code: "CONNREFUSED", responded: false };
    case "ECANCELLED":
      return { code: "CANCELLED", responded: false };
    default:
      return { code: "ERROR", responded: false };
  }
}

/**
 * Resolve `hostname` against a specific DNS `server`, measuring round-trip
 * time. Never rejects — failures are reported through {@link QueryOutcome}.
 */
export function timedQuery(
  server: string,
  hostname: string,
  rrtype: "A" | "AAAA" = "A",
  timeoutMs = 2500,
): Promise<QueryOutcome> {
  return new Promise((resolve) => {
    const resolver = new Resolver({ timeout: timeoutMs, tries: 1 });
    try {
      resolver.setServers([server]);
    } catch {
      resolve({ responded: false, resolved: false, ms: 0, code: "ERROR", addresses: [] });
      return;
    }

    const start = performance.now();
    let settled = false;
    const finish = (outcome: QueryOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve(outcome);
    };

    // Hard timeout in case the c-ares timer does not fire.
    const guard = setTimeout(() => {
      try {
        resolver.cancel();
      } catch {
        /* ignore */
      }
      finish({
        responded: false,
        resolved: false,
        ms: performance.now() - start,
        code: "TIMEOUT",
        addresses: [],
      });
    }, timeoutMs + 250);

    const callback = (err: NodeJS.ErrnoException | null, addresses?: string[]): void => {
      const { code, responded } = classify(err?.code);
      finish({
        responded,
        resolved: !err && Array.isArray(addresses) && addresses.length > 0,
        ms: performance.now() - start,
        code,
        addresses: addresses ?? [],
      });
    };

    if (rrtype === "AAAA") resolver.resolve6(hostname, callback);
    else resolver.resolve4(hostname, callback);
  });
}
