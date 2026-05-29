import { ping } from "./ping";
import type { PingResult } from "./types";

/** A reliable, low-latency anchor host for packet-loss measurement. */
const PACKET_LOSS_HOST = "1.1.1.1";

/** Send `count` pings to a stable target and report the loss rate. */
export async function measurePacketLoss(count = 20): Promise<PingResult> {
  return ping(PACKET_LOSS_HOST, count, { timeoutMs: count * 1200 + 5000 });
}
