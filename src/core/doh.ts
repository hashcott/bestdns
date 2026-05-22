/** Outcome of a DNS-over-HTTPS request. */
export interface DohOutcome {
  /** The endpoint accepted the query and answered successfully. */
  ok: boolean;
  /** Round-trip time in milliseconds. */
  ms: number;
  /** HTTP status code, when a response was received. */
  status?: number;
  /** Error message, when the request failed outright. */
  error?: string;
}

/**
 * Encode a DNS query for `name` (an A record) into RFC 1035 wire format.
 * This is the payload understood by every RFC 8484 DoH endpoint.
 */
function encodeDnsQuery(name: string): Uint8Array {
  const labels = name.split(".").filter(Boolean);
  const qnameLength = labels.reduce((total, label) => total + label.length + 1, 1);
  const buffer = new Uint8Array(12 + qnameLength + 4);
  const view = new DataView(buffer.buffer);

  // Header — recursion desired, exactly one question.
  view.setUint16(2, 0x0100); // flags: RD = 1
  view.setUint16(4, 1); // QDCOUNT

  // Question section.
  let offset = 12;
  for (const label of labels) {
    buffer[offset++] = label.length;
    for (let i = 0; i < label.length; i++) {
      buffer[offset++] = label.charCodeAt(i);
    }
  }
  buffer[offset++] = 0; // root label
  view.setUint16(offset, 1); // QTYPE = A
  view.setUint16(offset + 2, 1); // QCLASS = IN
  return buffer;
}

/** base64url encoding without padding, as required by RFC 8484. */
function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Query a DNS-over-HTTPS endpoint using the standard RFC 8484 wire format
 * and measure latency. Works with every major DoH provider — used both to
 * benchmark DoH and to check encrypted-DNS reachability.
 */
export async function dohQuery(
  dohUrl: string,
  name: string,
  timeoutMs = 4000,
): Promise<DohOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const url = new URL(dohUrl);
    url.searchParams.set("dns", base64url(encodeDnsQuery(name)));

    const res = await fetch(url, {
      headers: { accept: "application/dns-message" },
      signal: controller.signal,
    });
    // Drain the body so the connection can be released promptly.
    await res.arrayBuffer().catch(() => undefined);

    return { ok: res.ok, ms: performance.now() - start, status: res.status };
  } catch (err) {
    return {
      ok: false,
      ms: performance.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
