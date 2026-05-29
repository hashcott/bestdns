import { describe, expect, test } from "bun:test";
import { parsePing } from "../src/core/network/ping";

const MACOS_OUTPUT = `PING 1.1.1.1 (1.1.1.1): 56 data bytes
64 bytes from 1.1.1.1: icmp_seq=0 ttl=58 time=12.345 ms
64 bytes from 1.1.1.1: icmp_seq=1 ttl=58 time=14.567 ms
64 bytes from 1.1.1.1: icmp_seq=2 ttl=58 time=11.111 ms
64 bytes from 1.1.1.1: icmp_seq=3 ttl=58 time=15.222 ms

--- 1.1.1.1 ping statistics ---
4 packets transmitted, 4 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 11.111/13.311/15.222/1.560 ms`;

const LINUX_OUTPUT = `PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.
64 bytes from 1.1.1.1: icmp_seq=1 ttl=58 time=12.3 ms
64 bytes from 1.1.1.1: icmp_seq=2 ttl=58 time=14.5 ms

--- 1.1.1.1 ping statistics ---
4 packets transmitted, 3 received, 25% packet loss, time 3001ms
rtt min/avg/max/mdev = 12.300/13.400/14.500/1.100 ms`;

const WINDOWS_OUTPUT = `
Pinging 1.1.1.1 with 32 bytes of data:
Reply from 1.1.1.1: bytes=32 time=12ms TTL=58
Reply from 1.1.1.1: bytes=32 time=14ms TTL=58
Reply from 1.1.1.1: bytes=32 time=11ms TTL=58
Request timed out.

Ping statistics for 1.1.1.1:
    Packets: Sent = 4, Received = 3, Lost = 1 (25% loss),
Approximate round trip times in milli-seconds:
    Minimum = 11ms, Maximum = 14ms, Average = 12ms`;

describe("parsePing — macOS", () => {
  const result = parsePing(MACOS_OUTPUT, 4);
  test("counts sent and received packets", () => {
    expect(result.packetsSent).toBe(4);
    expect(result.packetsReceived).toBe(4);
  });
  test("extracts 0% loss", () => {
    expect(result.lossPct).toBe(0);
  });
  test("extracts average RTT", () => {
    expect(result.avgMs).toBeCloseTo(13.311, 2);
  });
});

describe("parsePing — Linux", () => {
  const result = parsePing(LINUX_OUTPUT, 4);
  test("counts sent and received packets", () => {
    expect(result.packetsSent).toBe(4);
    expect(result.packetsReceived).toBe(3);
  });
  test("extracts 25% loss", () => {
    expect(result.lossPct).toBe(25);
  });
  test("extracts average RTT from rtt summary", () => {
    expect(result.avgMs).toBeCloseTo(13.4, 1);
  });
});

describe("parsePing — Windows", () => {
  const result = parsePing(WINDOWS_OUTPUT, 4);
  test("counts sent and received packets", () => {
    expect(result.packetsSent).toBe(4);
    expect(result.packetsReceived).toBe(3);
  });
  test("extracts 25% loss", () => {
    expect(result.lossPct).toBe(25);
  });
  test("extracts integer average RTT", () => {
    expect(result.avgMs).toBe(12);
  });
});

describe("parsePing — empty output", () => {
  const result = parsePing("", 4);
  test("returns conservative defaults", () => {
    expect(result.packetsSent).toBe(4);
    expect(result.packetsReceived).toBe(0);
    expect(result.lossPct).toBe(100);
    expect(result.avgMs).toBeNull();
    expect(result.ok).toBe(false);
  });
});
