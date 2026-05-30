import { isRoot, run, runInteractive } from "../../os/exec";

/** Saved network credentials worth listing and pruning. */
export type ProfileKind = "wifi" | "location" | "connection";

/** A single saved network profile (Wi-Fi SSID, location, NM connection…). */
export interface NetworkProfile {
  /** Identifier passed back to `removeProfile`. */
  name: string;
  /** Which category the profile belongs to. */
  kind: ProfileKind;
  /** Optional secondary line (interface, last connected, type…). */
  detail?: string;
  /** True for the entry currently in use — don't suggest deletion. */
  active?: boolean;
}

export interface ProfilesResult {
  ok: boolean;
  profiles: NetworkProfile[];
  /** Which underlying tool produced the data. */
  mechanism: string;
  /** Optional caveat shown in the UI. */
  notes?: string;
}

export interface RemovalResult {
  ok: boolean;
  /** Exact command that ran, for the transparency log. */
  command: string;
  /** Human-readable status message. */
  message: string;
}

// ─── macOS ─────────────────────────────────────────────────────────────

const NETWORKSETUP = "/usr/sbin/networksetup";

/** Look up the device name of the Wi-Fi hardware port (e.g. `en0`). */
async function wifiInterface(): Promise<string | null> {
  const res = await run(NETWORKSETUP, ["-listallhardwareports"], 4000);
  if (!res.ok) return null;
  const blocks = res.stdout.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    if (/Hardware Port:\s*Wi-Fi/i.test(block)) {
      const match = /Device:\s*(\S+)/i.exec(block);
      if (match?.[1]) return match[1];
    }
  }
  return null;
}

/** Currently-connected SSID, used to mark the active Wi-Fi profile. */
async function currentSsid(): Promise<string | null> {
  const res = await run(
    "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport",
    ["-I"],
    3000,
  );
  if (!res.ok) return null;
  const match = /^\s*SSID:\s*(.+)$/m.exec(res.stdout);
  return match?.[1]?.trim() ?? null;
}

/** Currently-active macOS network location, used to protect it from pruning. */
async function currentLocation(): Promise<string | null> {
  const res = await run(NETWORKSETUP, ["-getcurrentlocation"], 3000);
  return res.ok ? res.stdout.trim() : null;
}

async function macProfiles(): Promise<ProfilesResult> {
  const profiles: NetworkProfile[] = [];
  const iface = await wifiInterface();
  const active = await currentSsid();
  const activeLocation = await currentLocation();

  if (iface) {
    const wifi = await run(NETWORKSETUP, ["-listpreferredwirelessnetworks", iface], 5000);
    if (wifi.ok) {
      // First line is "Preferred networks on <iface>:", rest are SSIDs (tab-indented).
      const ssids = wifi.stdout
        .split("\n")
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const ssid of ssids) {
        profiles.push({
          name: ssid,
          kind: "wifi",
          detail: iface,
          active: active !== null && ssid === active,
        });
      }
    }
  }

  const loc = await run(NETWORKSETUP, ["-listlocations"], 4000);
  if (loc.ok) {
    const locations = loc.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const name of locations) {
      profiles.push({
        name,
        kind: "location",
        active: activeLocation !== null && name === activeLocation,
      });
    }
  }

  return { ok: true, profiles, mechanism: "networksetup" };
}

async function macRemove(profile: NetworkProfile): Promise<RemovalResult> {
  const iface = profile.kind === "wifi" ? await wifiInterface() : null;
  const args =
    profile.kind === "wifi"
      ? ["-removepreferredwirelessnetwork", iface ?? "en0", profile.name]
      : ["-deletelocation", profile.name];
  const preview = `networksetup ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`;

  if (isRoot()) {
    const res = await run(NETWORKSETUP, args);
    return {
      ok: res.ok,
      command: preview,
      message: res.ok ? `Removed ${profile.kind} "${profile.name}".` : res.stderr || "Failed.",
    };
  }
  const code = await runInteractive("sudo", [NETWORKSETUP, ...args]);
  return {
    ok: code === 0,
    command: `sudo ${preview}`,
    message: code === 0 ? `Removed ${profile.kind} "${profile.name}".` : "Cancelled or failed.",
  };
}

// ─── Linux (NetworkManager via nmcli) ──────────────────────────────────

async function linuxProfiles(): Promise<ProfilesResult> {
  const res = await run(
    "nmcli",
    ["-t", "-f", "NAME,TYPE,AUTOCONNECT,TIMESTAMP-REAL", "connection", "show"],
    6000,
  );
  if (!res.ok) {
    return {
      ok: false,
      profiles: [],
      mechanism: "nmcli",
      notes: "`nmcli` unavailable — profile management needs NetworkManager.",
    };
  }
  const active = await run("nmcli", ["-t", "-f", "NAME", "connection", "show", "--active"], 5000);
  const activeNames = new Set(
    active.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );

  const profiles: NetworkProfile[] = res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", type = "", autoconnect = "", lastSeen = ""] = line.split(":");
      return {
        name,
        kind: "connection" as const,
        detail: [type, autoconnect === "yes" ? "auto" : null, lastSeen]
          .filter((part): part is string => Boolean(part))
          .join(" · "),
        active: activeNames.has(name),
      };
    });

  return { ok: true, profiles, mechanism: "nmcli" };
}

async function linuxRemove(profile: NetworkProfile): Promise<RemovalResult> {
  const preview = `nmcli connection delete "${profile.name}"`;
  if (isRoot()) {
    const res = await run("nmcli", ["connection", "delete", profile.name]);
    return {
      ok: res.ok,
      command: preview,
      message: res.ok ? `Removed connection "${profile.name}".` : res.stderr || "Failed.",
    };
  }
  const code = await runInteractive("sudo", ["nmcli", "connection", "delete", profile.name]);
  return {
    ok: code === 0,
    command: `sudo ${preview}`,
    message: code === 0 ? `Removed connection "${profile.name}".` : "Cancelled or failed.",
  };
}

// ─── Windows (netsh WLAN profiles) ─────────────────────────────────────

async function windowsProfiles(): Promise<ProfilesResult> {
  const res = await run("netsh.exe", ["wlan", "show", "profiles"], 8000);
  if (!res.ok) {
    return {
      ok: false,
      profiles: [],
      mechanism: "netsh",
      notes: "netsh failed — is the WLAN service running?",
    };
  }
  // Lines look like:  "    All User Profile     : MyWiFi"
  const ssids: string[] = [];
  for (const line of res.stdout.split("\n")) {
    const m = /Profile\s*:\s*(.+)$/i.exec(line.trim());
    if (m?.[1]) ssids.push(m[1].trim());
  }
  // Mark the currently-connected one as active.
  let active: string | null = null;
  const ifaces = await run("netsh.exe", ["wlan", "show", "interfaces"], 5000);
  if (ifaces.ok) {
    const m = /^\s*SSID\s*:\s*(.+)$/m.exec(ifaces.stdout);
    if (m?.[1]) active = m[1].trim();
  }
  return {
    ok: true,
    mechanism: "netsh",
    profiles: ssids.map((name) => ({
      name,
      kind: "wifi",
      active: active !== null && name === active,
    })),
  };
}

async function windowsRemove(profile: NetworkProfile): Promise<RemovalResult> {
  const preview = `netsh wlan delete profile name="${profile.name}"`;
  // netsh wlan delete profile generally needs admin rights.
  const code = await runInteractive("netsh.exe", [
    "wlan",
    "delete",
    "profile",
    `name=${profile.name}`,
  ]);
  return {
    ok: code === 0,
    command: preview,
    message:
      code === 0
        ? `Removed Wi-Fi profile "${profile.name}".`
        : "Failed — you may need to run from an elevated terminal.",
  };
}

// ─── Public API ────────────────────────────────────────────────────────

/** List every saved network profile the OS knows about. */
export async function listProfiles(): Promise<ProfilesResult> {
  switch (process.platform) {
    case "darwin":
      return macProfiles();
    case "linux":
      return linuxProfiles();
    case "win32":
      return windowsProfiles();
    default:
      return {
        ok: false,
        profiles: [],
        mechanism: "n/a",
        notes: `Profile management is not implemented for ${process.platform}.`,
      };
  }
}

/** Remove a single profile, elevating privileges where required. */
export async function removeProfile(profile: NetworkProfile): Promise<RemovalResult> {
  switch (process.platform) {
    case "darwin":
      return macRemove(profile);
    case "linux":
      return linuxRemove(profile);
    case "win32":
      return windowsRemove(profile);
    default:
      return {
        ok: false,
        command: "",
        message: `Not implemented for ${process.platform}.`,
      };
  }
}
