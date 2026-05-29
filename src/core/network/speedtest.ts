import type { SpeedtestResult } from "./types";

/**
 * Cloudflare's public speedtest endpoint streams `bytes` of incompressible
 * data — perfect for measuring real-world download throughput without
 * shelling out to a third-party CLI.
 */
const ENDPOINT = "https://speed.cloudflare.com/__down";

/**
 * Measure download throughput by streaming bytes from Cloudflare. Uses a
 * deadline + cancellation rather than a fixed file size so the call is
 * bounded even on very slow links.
 */
export async function runSpeedtest(
  options: { maxBytes?: number; maxDurationMs?: number } = {},
): Promise<SpeedtestResult> {
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024; // 50 MB ceiling
  const maxDurationMs = options.maxDurationMs ?? 8000; // 8 s wall clock

  const controller = new AbortController();
  const start = performance.now();
  const deadline = setTimeout(() => controller.abort(), maxDurationMs);

  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("bytes", String(maxBytes));
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      clearTimeout(deadline);
      return {
        ok: false,
        downloadMbps: 0,
        bytesTransferred: 0,
        durationMs: performance.now() - start,
        error: `HTTP ${response.status}`,
      };
    }

    let received = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
    }
    clearTimeout(deadline);

    const durationMs = performance.now() - start;
    const downloadMbps = (received * 8) / (durationMs / 1000) / 1_000_000;
    return { ok: received > 0, downloadMbps, bytesTransferred: received, durationMs };
  } catch (error) {
    clearTimeout(deadline);
    // AbortError after the deadline still counts as a measurement — we know
    // how many bytes we managed to pull and can report a number.
    const durationMs = performance.now() - start;
    const abort = error instanceof Error && error.name === "AbortError";
    if (!abort) {
      return {
        ok: false,
        downloadMbps: 0,
        bytesTransferred: 0,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    // For aborted reads we can't know exact bytes, so flag a successful
    // bounded run with 0 throughput; the diagnose layer will mark it as
    // a timeout-driven measurement.
    return {
      ok: false,
      downloadMbps: 0,
      bytesTransferred: 0,
      durationMs,
      error: "timeout",
    };
  }
}
