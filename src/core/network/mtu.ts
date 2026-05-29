import { ping } from "./ping";
import type { MtuResult } from "./types";

/**
 * Common path MTU values, descending. We try each as the IP packet size and
 * pick the largest that survives without fragmentation.
 *  - 1500: Ethernet baseline.
 *  - 1492: PPPoE links (most consumer DSL).
 *  - 1480 / 1472: GRE / common tunnel overhead.
 *  - 1450 / 1400: IPSec / WireGuard / typical commercial VPNs.
 *  - 1300 / 1280: very lossy tunnels; 1280 is the IPv6 minimum.
 */
const CANDIDATE_MTUS = [1500, 1492, 1480, 1472, 1450, 1400, 1300, 1280];

const MTU_TARGET = "1.1.1.1";

/** Negotiate path MTU by probing decreasing payload sizes with the DF bit. */
export async function detectMtu(): Promise<MtuResult> {
  const tried: number[] = [];
  try {
    for (const mtu of CANDIDATE_MTUS) {
      tried.push(mtu);
      // Convert IP MTU to ICMP payload: 20-byte IP header + 8-byte ICMP header.
      const payload = mtu - 28;
      const result = await ping(MTU_TARGET, 1, {
        df: true,
        payloadBytes: payload,
        timeoutMs: 4000,
      });
      const fragmented = /too long|fragmented|message size/i.test(result.raw);
      if (result.ok && !fragmented) {
        return { pathMtu: mtu, triedSizes: tried, available: true };
      }
    }
    return { pathMtu: null, triedSizes: tried, available: true };
  } catch (error) {
    return {
      pathMtu: null,
      triedSizes: tried,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
