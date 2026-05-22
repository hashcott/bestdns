import { describe, expect, test } from "bun:test";
import { isDnsServer, isIpv4, isIpv6, mean, pool, randomLabel, stddev } from "../src/util";

describe("isIpv4", () => {
  test("accepts valid addresses", () => {
    expect(isIpv4("1.1.1.1")).toBe(true);
    expect(isIpv4("192.168.0.1")).toBe(true);
    expect(isIpv4("255.255.255.255")).toBe(true);
  });

  test("rejects invalid addresses", () => {
    expect(isIpv4("999.1.1.1")).toBe(false);
    expect(isIpv4("1.1.1")).toBe(false);
    expect(isIpv4("hello")).toBe(false);
    expect(isIpv4("")).toBe(false);
  });
});

describe("isIpv6", () => {
  test("accepts valid addresses", () => {
    expect(isIpv6("2606:4700:4700::1111")).toBe(true);
    expect(isIpv6("2620:fe::fe")).toBe(true);
  });

  test("rejects non-IPv6 input", () => {
    expect(isIpv6("1.1.1.1")).toBe(false);
    expect(isIpv6("not-an-address")).toBe(false);
  });
});

describe("isDnsServer", () => {
  test("accepts IPv4 and IPv6", () => {
    expect(isDnsServer("8.8.8.8")).toBe(true);
    expect(isDnsServer("2001:4860:4860::8888")).toBe(true);
  });

  test("rejects junk", () => {
    expect(isDnsServer("There aren't any DNS Servers set.")).toBe(false);
  });
});

describe("mean and stddev", () => {
  test("mean of values", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  test("stddev is zero for constant data", () => {
    expect(stddev([5, 5, 5])).toBe(0);
  });

  test("stddev is positive for varied data", () => {
    expect(stddev([1, 2, 3, 4])).toBeGreaterThan(0);
  });
});

describe("pool", () => {
  test("runs every item and preserves order", async () => {
    const result = await pool([1, 2, 3, 4], 2, async (n) => n * 2);
    expect(result).toEqual([2, 4, 6, 8]);
  });

  test("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await pool([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("randomLabel", () => {
  test("is prefixed and reasonably unique", () => {
    expect(randomLabel()).toMatch(/^bestdns-[a-z0-9]+$/);
    expect(randomLabel()).not.toBe(randomLabel());
  });
});
