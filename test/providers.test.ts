import { describe, expect, test } from "bun:test";
import { BUILT_IN_PROVIDERS, GROUPS, GROUP_ORDER } from "../src/data/providers";
import { isDnsServer } from "../src/util";

describe("provider catalog", () => {
  test("provider ids are unique", () => {
    const ids = BUILT_IN_PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("provider ids are kebab-case", () => {
    for (const provider of BUILT_IN_PROVIDERS) {
      expect(provider.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
  });

  test("every provider has at least one valid IPv4 address", () => {
    for (const provider of BUILT_IN_PROVIDERS) {
      expect(provider.ipv4.length).toBeGreaterThan(0);
      for (const address of provider.ipv4) {
        expect(isDnsServer(address)).toBe(true);
      }
    }
  });

  test("IPv6 addresses, when present, are valid", () => {
    for (const provider of BUILT_IN_PROVIDERS) {
      for (const address of provider.ipv6 ?? []) {
        expect(isDnsServer(address)).toBe(true);
      }
    }
  });

  test("every provider belongs to a known group", () => {
    for (const provider of BUILT_IN_PROVIDERS) {
      expect(GROUP_ORDER).toContain(provider.group);
    }
  });

  test("DoH endpoints, when present, are HTTPS URLs", () => {
    for (const provider of BUILT_IN_PROVIDERS) {
      if (provider.doh) {
        expect(provider.doh.startsWith("https://")).toBe(true);
      }
    }
  });
});

describe("provider groups", () => {
  test("there are exactly three groups", () => {
    expect(GROUP_ORDER).toHaveLength(3);
  });

  test("each group has at least one provider", () => {
    for (const group of GROUP_ORDER) {
      expect(BUILT_IN_PROVIDERS.some((provider) => provider.group === group)).toBe(true);
    }
  });

  test("group metadata is consistent with its key", () => {
    for (const group of GROUP_ORDER) {
      expect(GROUPS[group].id).toBe(group);
      expect(GROUPS[group].label.length).toBeGreaterThan(0);
    }
  });
});
