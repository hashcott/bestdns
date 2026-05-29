import { run } from "../../os/exec";
import type { WifiInfo } from "./types";

const AIRPORT =
  "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";

/** Pull a `Key: value` pair out of a flat text block. */
function pluck(text: string, key: string): string | undefined {
  const re = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "im");
  return re.exec(text)?.[1]?.trim();
}

async function macWifi(): Promise<WifiInfo> {
  const res = await run(AIRPORT, ["-I"], 5000);
  if (!res.ok) return { available: false, connected: false };
  const text = res.stdout;
  if (/AirPort:\s*Off/.test(text)) {
    return { available: true, connected: false };
  }
  const ssid = pluck(text, "SSID");
  const rssi = pluck(text, "agrCtlRSSI");
  const noise = pluck(text, "agrCtlNoise");
  const rate = pluck(text, "lastTxRate");
  const channel = pluck(text, "channel");
  return {
    available: true,
    connected: Boolean(ssid),
    ssid,
    signalDbm: rssi ? Number(rssi) : undefined,
    noiseDbm: noise ? Number(noise) : undefined,
    channel,
    txRateMbps: rate ? Number(rate) : undefined,
    raw: text,
  };
}

async function linuxWifi(): Promise<WifiInfo> {
  const devs = await run("iw", ["dev"], 4000);
  if (!devs.ok) return { available: false, connected: false };
  const ifaceMatch = /Interface\s+(\S+)/i.exec(devs.stdout);
  const iface = ifaceMatch?.[1];
  if (!iface) return { available: true, connected: false };

  const link = await run("iw", ["dev", iface, "link"], 4000);
  if (!link.ok || /Not connected/i.test(link.stdout)) {
    return { available: true, connected: false };
  }
  const text = link.stdout;
  const ssid = pluck(text, "SSID");
  const signal = /signal:\s*(-?\d+)\s*dBm/i.exec(text)?.[1];
  const tx = /tx bitrate:\s*([\d.]+)\s*MBit\/s/i.exec(text)?.[1];
  const rx = /rx bitrate:\s*([\d.]+)\s*MBit\/s/i.exec(text)?.[1];
  const freq = /freq:\s*(\d+)/i.exec(text)?.[1];
  return {
    available: true,
    connected: true,
    ssid,
    signalDbm: signal ? Number(signal) : undefined,
    txRateMbps: tx ? Number(tx) : undefined,
    rxRateMbps: rx ? Number(rx) : undefined,
    channel: freq,
    raw: text,
  };
}

async function windowsWifi(): Promise<WifiInfo> {
  const res = await run("netsh.exe", ["wlan", "show", "interfaces"], 5000);
  if (!res.ok) return { available: false, connected: false };
  const text = res.stdout;
  if (/State\s*:\s*disconnected/i.test(text)) {
    return { available: true, connected: false };
  }
  const ssid = pluck(text, "SSID");
  const signalPct = pluck(text, "Signal");
  const channel = pluck(text, "Channel");
  const tx = pluck(text, "Transmit rate \\(Mbps\\)");
  const rx = pluck(text, "Receive rate \\(Mbps\\)");

  // Windows reports signal as a percentage 0–100%. Approximate dBm assuming
  // 0% ≈ -100 dBm, 100% ≈ -50 dBm.
  let signalDbm: number | undefined;
  if (signalPct) {
    const pct = Number(signalPct.replace("%", "").trim());
    if (Number.isFinite(pct)) signalDbm = Math.round(pct / 2 - 100);
  }

  return {
    available: true,
    connected: true,
    ssid,
    signalDbm,
    channel,
    txRateMbps: tx ? Number(tx) : undefined,
    rxRateMbps: rx ? Number(rx) : undefined,
    raw: text,
  };
}

/** Detect Wi-Fi connection details using the most appropriate native tool. */
export async function getWifiInfo(): Promise<WifiInfo> {
  try {
    switch (process.platform) {
      case "darwin":
        return await macWifi();
      case "linux":
        return await linuxWifi();
      case "win32":
        return await windowsWifi();
      default:
        return { available: false, connected: false };
    }
  } catch {
    return { available: false, connected: false };
  }
}
