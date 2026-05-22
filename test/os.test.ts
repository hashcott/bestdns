import { describe, expect, test } from "bun:test";
import { type NetworkService, getBackend, pickService } from "../src/os";
import { macosBackend } from "../src/os/macos";
import { windowsBackend } from "../src/os/windows";

const SERVICES: NetworkService[] = [
  { id: "eth", name: "Ethernet", active: false },
  { id: "wifi", name: "Wi-Fi", active: true },
];

describe("pickService", () => {
  test("matches by id", () => {
    expect(pickService(SERVICES, "eth")?.id).toBe("eth");
  });

  test("matches by name, case-insensitively", () => {
    expect(pickService(SERVICES, "wi-fi")?.id).toBe("wifi");
  });

  test("falls back to the active service when no query is given", () => {
    expect(pickService(SERVICES)?.id).toBe("wifi");
  });

  test("returns undefined for an unknown query", () => {
    expect(pickService(SERVICES, "does-not-exist")).toBeUndefined();
  });
});

describe("command previews", () => {
  test("macOS builds the expected networksetup commands", () => {
    const service: NetworkService = { id: "Wi-Fi", name: "Wi-Fi", active: true };
    expect(macosBackend.previewSet(service, ["1.1.1.1", "1.0.0.1"])).toBe(
      'networksetup -setdnsservers "Wi-Fi" 1.1.1.1 1.0.0.1',
    );
    expect(macosBackend.previewReset(service)).toBe('networksetup -setdnsservers "Wi-Fi" empty');
  });

  test("Windows builds the expected DnsClient command", () => {
    const service: NetworkService = { id: "12", name: "Ethernet", active: true };
    expect(windowsBackend.previewSet(service, ["8.8.8.8", "8.8.4.4"])).toBe(
      'Set-DnsClientServerAddress -InterfaceIndex 12 -ServerAddresses ("8.8.8.8","8.8.4.4")',
    );
    expect(windowsBackend.previewReset(service)).toBe(
      "Set-DnsClientServerAddress -InterfaceIndex 12 -ResetServerAddresses",
    );
  });
});

describe("getBackend", () => {
  test("returns a supported backend on macOS, Linux and Windows", () => {
    const backend = getBackend();
    if (["darwin", "linux", "win32"].includes(process.platform)) {
      expect(backend.supported).toBe(true);
      expect(backend.platform).toBe(process.platform);
    } else {
      expect(backend.supported).toBe(false);
    }
  });
});
