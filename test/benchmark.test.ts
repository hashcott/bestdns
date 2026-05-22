import { describe, expect, test } from "bun:test";
import { benchmarkProvider } from "../src/core/benchmark";
import type { DnsProvider } from "../src/types";

describe("benchmarkProvider", () => {
  test("marks a provider with no address as failed", async () => {
    const provider: DnsProvider = {
      id: "addressless",
      name: "Addressless",
      group: "non-filtering",
      ipv4: [],
    };
    const result = await benchmarkProvider(provider, 1, 500);
    expect(result.failed).toBe(true);
    expect(result.reliability).toBe(0);
    expect(result.samples).toBe(0);
    expect(result.server).toBe("");
  });

  test("treats an unroutable address as a failure rather than throwing", async () => {
    const provider: DnsProvider = {
      id: "unroutable",
      name: "Unroutable",
      group: "non-filtering",
      // TEST-NET-1 (RFC 5737) — guaranteed not to host a DNS resolver.
      ipv4: ["192.0.2.1"],
    };
    const result = await benchmarkProvider(provider, 1, 600);
    expect(result.failed).toBe(true);
    expect(result.attempts).toBeGreaterThan(0);
  }, 15000);
});
