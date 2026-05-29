<div align="center">

# ⚡ bestdns

**Find the fastest, safest DNS for your network — then apply it in one step.**

A cross-platform CLI that benchmarks public DNS providers, ranks them by real-world
latency, and applies the winner to your OS network settings — with backups, health
checks, and a polished interactive UX.

[![npm version](https://img.shields.io/npm/v/bestdns?color=cb3837&label=npm&logo=npm)](https://www.npmjs.com/package/bestdns)
[![npm downloads](https://img.shields.io/npm/dm/bestdns?color=cb3837&logo=npm)](https://www.npmjs.com/package/bestdns)
[![CI](https://github.com/hashcott/bestdns/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hashcott/bestdns/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node ≥ 18](https://img.shields.io/node/v/bestdns?logo=node.js&color=339933)](https://nodejs.org)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-informational)](#platform-support)

```bash
npx bestdns
```

</div>

---

## Table of contents

- [Why bestdns?](#why-bestdns)
- [Features](#features)
- [Quick start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Commands](#commands)
  - [`bestdns optimize`](#bestdns-optimize) — full optimization flow
  - [`bestdns diagnose`](#bestdns-diagnose) — read-only checkup
- [Provider catalog](#provider-catalog)
- [Health checks](#health-checks)
- [Configuration & data files](#configuration--data-files)
- [Platform support](#platform-support)
- [How it works](#how-it-works)
- [Development](#development)
- [Contributing](#contributing)
- [Releasing (maintainers)](#releasing-maintainers)
- [Roadmap](#roadmap)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## Why bestdns?

Choosing a DNS server is the cheapest, fastest network upgrade most people never make.
The "best" one depends on **where you are right now**: a resolver that's blazing fast in
Hanoi may be slow in São Paulo, and the one your ISP picks is rarely either fast or
private.

`bestdns` measures DNS providers from **your** machine, ranks them honestly, and lets
you apply the winner without copy-pasting IPs into network preferences. It also tells
you whether each provider validates DNSSEC, hijacks NXDOMAIN responses, blocks ads, and
supports DNS-over-HTTPS — so "fastest" isn't the only thing you optimise for.

## Features

> It was a simple goal — make the internet faster.
>
> Ran a speedtest. Checked DNS resolution times. Probed the path MTU,
> measured packet loss, read Wi-Fi signal strength and channel interference.
> Found three issues. Flushed a stale DNS cache. Restarted mDNSResponder.
> Swapped the resolver for the fastest one on the network.
> Ran the whole thing again to prove the numbers actually moved.
>
> No AI. No cloud API. No black box. Just the network stack, a handful of
> shell commands, and an honest before/after comparison.

- 🛠 **Optimize** — full network optimization flow: baseline snapshot → walk through
  auto-fixable findings (DNS swap, cache flush, mDNS restart) → re-test for a
  side-by-side before/after.
- 🔬 **Diagnose** — read-only network checkup: download speed, latency, packet loss,
  path MTU, Wi-Fi signal, and current DNS performance, all with severity-ranked
  findings.
- 🔍 **Benchmark** — measures latency, jitter and reliability across a curated catalog
  of public resolvers and ranks them fastest-first.
- ⚡ **Auto** — benchmark and apply the fastest provider in a single command.
- 🎯 **Apply** — set DNS for your active network service, cross-platform, with privilege
  elevation handled for you (`sudo` / UAC).
- 📡 **Current** — show the DNS each network service is using and identify which catalog
  provider is behind it.
- 🩺 **Health checks** — DNSSEC validation, NXDOMAIN-hijacking detection, ad/tracker
  blocking and DNS-over-HTTPS reachability (proper RFC 8484 wire format).
- 📋 **Catalog management** — browse 16+ built-in providers grouped into
  _Non-filtering_, _Security & Ad-blocking_ and _Family-safe_, and add your own.
- ↩️ **Backup & restore** — your previous DNS is saved before every change; revert to
  automatic (DHCP) with one command.
- 🔄 **Update checker** — tells you when a newer version is available (only in
  interactive terminals; never pollutes `--json` output).
- 🖥️ **Beautiful UX** — an interactive menu (built on
  [clack](https://github.com/bombshell-dev/clack)) when run with no arguments, plus a
  fully scriptable flag-based interface with `--json` for piping into other tools.

## Quick start

Run it instantly, no install required:

```bash
npx bestdns
```

Or just benchmark and apply the fastest DNS in one go:

```bash
npx bestdns auto
```

> Changing DNS requires admin privileges. On macOS and Linux you'll be prompted for
> your password via `sudo`; on Windows a UAC prompt appears. Use `--dry-run` to preview
> the exact command without executing it.

## Installation

### npx (recommended)

No install — always runs the latest version:

```bash
npx bestdns
```

### Global

Install once, run anywhere:

```bash
npm install -g bestdns
bestdns
```

### Per-project / Bun / pnpm / Yarn

```bash
bun add -d bestdns        # Bun
pnpm add -D bestdns       # pnpm
yarn add -D bestdns       # Yarn
```

Then call it via your package manager's runner, e.g. `bun run bestdns` or as an npm
script.

## Usage

`bestdns` has two faces — pick whichever fits the task.

**Interactive menu** — run with no arguments to get an arrow-key navigated menu:

```text
┌  ⚡ bestdns  v1.0.1
│
◆  What would you like to do?
│  ● ⚡ Auto — benchmark & apply the fastest  (recommended)
│  ○ 🔍 Benchmark DNS providers
│  ○ 📡 Show current DNS
│  ○ 🎯 Apply a DNS provider
│  ○ 🩺 Health & capability check
│  ○ 📋 Manage provider list
│  ○ ↩️  Restore DNS to automatic
│  ○ 👋 Exit
```

**Scriptable** — every action has a matching subcommand with flags and `--json`:

```bash
bestdns benchmark --group security --top 5 --json | jq '.[0]'
bestdns current --json | jq '.[] | select(.active)'
bestdns apply cloudflare --dry-run
```

## Commands

| Command | Description |
| --- | --- |
| `bestdns` | Open the interactive menu |
| `bestdns optimize` | Diagnose, apply auto-fixes, re-test (before/after) |
| `bestdns diagnose` | Read-only network checkup (alias: `doctor`) |
| `bestdns auto` | Benchmark every provider and apply the fastest |
| `bestdns benchmark` | Benchmark providers and rank them by speed |
| `bestdns apply <provider>` | Apply a DNS provider to your network |
| `bestdns current` | Show the current DNS configuration |
| `bestdns health [provider]` | Check DNSSEC, hijacking, ad-blocking and DoH |
| `bestdns list` | Browse and manage the provider catalog |
| `bestdns restore` | Restore DNS to automatic (DHCP) |
| `bestdns menu` | Force-open the interactive menu (even with args) |

### `bestdns optimize`

End-to-end network optimization in three phases:

1. **Baseline snapshot** — runs every diagnostic check and lists findings.
2. **Apply auto-fixes** — walks through each auto-fixable finding (swap DNS, flush
   DNS cache, restart mDNSResponder on macOS) with per-step confirmation.
3. **Re-test** — takes a second snapshot and prints a before/after comparison.

```text
-y, --yes              apply every offered fix without confirming
    --no-speedtest     skip the download speedtest in both snapshots
    --no-mtu           skip the path-MTU probe
    --no-retest        skip the second (after) snapshot
```

```bash
bestdns optimize                           # interactive flow with confirmations
bestdns optimize --yes                     # apply every offered fix
bestdns optimize --no-speedtest --no-mtu   # quick run: skip the slow checks
```

What each auto-fix actually does:

| Fix | What runs | Privilege |
| --- | --- | --- |
| **Swap DNS** | Internally calls `bestdns auto` — benchmark and apply the fastest provider to the active network service | `sudo` / UAC |
| **Flush DNS cache** | macOS: `dscacheutil -flushcache && killall -HUP mDNSResponder` · Linux: `resolvectl flush-caches` (fallback `nscd -i hosts`) · Windows: `ipconfig /flushdns` | `sudo` on macOS / Linux |
| **Restart mDNSResponder** | `launchctl kickstart -k system/com.apple.mDNSResponder` | `sudo`, macOS only |

### `bestdns diagnose`

Read-only network checkup — useful for "is it me or the network?" before changing
anything. Runs everything `optimize` runs, but applies nothing.

```text
    --no-speedtest     skip the download speedtest
    --no-mtu           skip the path-MTU probe
    --json             output machine-readable JSON
```

```bash
bestdns diagnose                           # full report
bestdns diagnose --no-speedtest --no-mtu   # quick (~3 s) check
bestdns diagnose --json | jq '.findings'   # pipe findings into another tool
bestdns doctor                             # alias
```

What it measures:

| Check | How |
| --- | --- |
| **Download speed** | Streams up to 50 MB from Cloudflare's public speedtest endpoint with an 8-second deadline. |
| **Latency** | 4 pings each to `1.1.1.1`, `8.8.8.8`, `github.com`. |
| **Packet loss** | 20 pings to `1.1.1.1`. |
| **Path MTU** | DF-bit pings at common candidate sizes (1500 → 1280). |
| **Wi-Fi signal** | Native tools: `airport -I` on macOS, `iw dev` on Linux, `netsh wlan show interfaces` on Windows. |
| **Current DNS** | Three quick lookups against the active resolver. |

Findings are sorted by severity (`ISSUE` → `WARN` → `INFO` → `OK`) and tagged
*"auto-fix available"* when `optimize` can resolve them.

Example output:

```text
Download      124.8 Mbps (50.0 MB in 3.4 s)
Latency       42 ms avg across 3 target(s)
Packet loss   0.0% (20/20 to 1.1.1.1)
Path MTU      1492
Current DNS   8.8.8.8, 8.8.4.4 (30 ms avg)

┌───┬─────────┬────────────────────────────────┬─────────────────────────────────────┐
│   │ Severity│ Finding                        │ Detail                              │
├───┼─────────┼────────────────────────────────┼─────────────────────────────────────┤
│ ℹ │ INFO    │ Path MTU is 1492               │ Common when on PPPoE, GRE or a VPN  │
│ ℹ │ INFO    │ Flush the OS DNS cache         │ (auto-fix available)                │
│ ℹ │ INFO    │ Restart mDNSResponder          │ (auto-fix available)                │
│ ✔ │ OK      │ Download throughput is healthy │ Measured 124.8 Mbps over 3.4 s.     │
│ ✔ │ OK      │ No packet loss                 │ 20/20 packets received from 1.1.1.1 │
│ ✔ │ OK      │ Internet latency looks fine    │ 42 ms average across 3 hosts.       │
│ ✔ │ OK      │ Current DNS is fast            │ Current resolver averages 30 ms.    │
└───┴─────────┴────────────────────────────────┴─────────────────────────────────────┘
```

### `bestdns benchmark`

```text
-g, --group <category>   limit to a category: non-filtering | security | family | all
-r, --rounds <n>         measured rounds per provider (default 5)
-t, --top <n>            show only the fastest N providers
    --json               output machine-readable JSON
```

```bash
bestdns benchmark                          # all categories, full table
bestdns benchmark --group security         # only ad-blocking / security resolvers
bestdns benchmark --top 5 --json           # fastest 5 in JSON
```

Output example:

```text
┌─────┬───────────────────────┬─────────────────────────┬─────────┬─────────┬───────────┬─────────────┐
│ #   │ Provider              │ Group                   │ Avg     │ Fastest │ Jitter    │ Reliability │
├─────┼───────────────────────┼─────────────────────────┼─────────┼─────────┼───────────┼─────────────┤
│ ★ 1 │ Google Public DNS     │ Non-filtering           │ 34.0 ms │ 23.9 ms │ ± 12.6 ms │ 100%        │
│     │ 8.8.8.8               │                         │         │         │           │             │
│ 2   │ Cloudflare            │ Non-filtering           │ 50.2 ms │ 40.4 ms │ ± 4.9 ms  │ 100%        │
│     │ 1.1.1.1               │                         │         │         │           │             │
│ 3   │ AdGuard DNS (Default) │ Security & Ad-blocking  │ 52.7 ms │ 41.3 ms │ ± 8.0 ms  │ 100%        │
│     │ 94.140.14.14          │                         │         │         │           │             │
└─────┴───────────────────────┴─────────────────────────┴─────────┴─────────┴───────────┴─────────────┘
```

### `bestdns apply`

```text
-s, --service <name>     target a specific network service
    --ipv6               also configure IPv6 addresses
    --dry-run            print the command without running it
-y, --yes                skip the confirmation prompt
```

```bash
bestdns apply cloudflare                   # interactive confirmation
bestdns apply quad9 --yes                  # no confirmation
bestdns apply adguard --ipv6               # also set IPv6
bestdns apply cloudflare --dry-run         # see the exact networksetup / nmcli /
                                           #   PowerShell command without running it
```

### `bestdns current`

```bash
bestdns current             # human-readable
bestdns current --json      # machine-readable
```

### `bestdns health`

```bash
bestdns health cloudflare              # detailed report for one provider
bestdns health --group security        # capability matrix across a group
bestdns health --group all --json      # full matrix in JSON
```

### `bestdns list`

```bash
bestdns list                # show every provider (built-in + your custom)
bestdns list groups         # show categories with provider counts
bestdns list add            # interactively add a custom provider
bestdns list remove <id>    # remove a custom provider
```

### `bestdns restore`

```bash
bestdns restore             # revert to automatic / DHCP
bestdns restore -s "Wi-Fi"  # target a specific service
```

## Provider catalog

The catalog follows the taxonomy from the
[AdGuard DNS knowledge base](https://adguard-dns.io/kb/general/dns-providers/).

### 🚀 Non-filtering — fast & private

Pure resolvers with no content filtering. Use these when you want raw speed and don't
need ad-blocking at the DNS layer.

| Provider | IPv4 |
| --- | --- |
| Cloudflare | `1.1.1.1`, `1.0.0.1` |
| Google Public DNS | `8.8.8.8`, `8.8.4.4` |
| Quad9 (Unfiltered) | `9.9.9.10`, `149.112.112.10` |
| OpenDNS (Cisco) | `208.67.222.222`, `208.67.220.220` |
| AdGuard DNS (Non-filtering) | `94.140.14.140`, `94.140.14.141` |

### 🛡️ Security & Ad-blocking

Block ads, trackers, malware and phishing domains at the DNS layer.

| Provider | IPv4 |
| --- | --- |
| AdGuard DNS (Default) | `94.140.14.14`, `94.140.15.15` |
| Cloudflare (Malware Blocking) | `1.1.1.2`, `1.0.0.2` |
| Quad9 | `9.9.9.9`, `149.112.112.112` |
| CleanBrowsing (Security) | `185.228.168.9`, `185.228.169.9` |
| Mullvad (Ad-blocking) | `194.242.2.3` |
| Control D (Malware + Ads) | `76.76.2.2`, `76.76.10.2` |
| DNS0.eu | `193.110.81.0`, `185.253.5.0` |

### 👨‍👩‍👧 Family-safe

Block adult content on top of security filtering — useful for shared / kids' devices.

| Provider | IPv4 |
| --- | --- |
| AdGuard DNS (Family Protection) | `94.140.14.15`, `94.140.15.16` |
| Cloudflare for Families | `1.1.1.3`, `1.0.0.3` |
| CleanBrowsing (Family) | `185.228.168.168`, `185.228.169.168` |
| OpenDNS FamilyShield | `208.67.222.123`, `208.67.220.123` |

### Adding your own

```bash
bestdns list add
```

You'll be prompted for an id, name, category, IPv4 addresses, optional IPv6, and an
optional DoH endpoint. Custom providers persist in
[`custom-providers.json`](#configuration--data-files) and appear alongside built-ins
everywhere.

## Health checks

For each provider, `bestdns health` reports:

| Check | What it tests | How |
| --- | --- | --- |
| **Reachable** | Server answered a basic query | Resolve `example.com` |
| **DNSSEC validation** | Server validates DNS signatures | Resolve `dnssec-failed.org` — validators return `SERVFAIL`, lax resolvers return an address |
| **No NXDOMAIN hijacking** | Server honestly says "doesn't exist" rather than redirecting to an ad page | Resolve a random unguessable subdomain |
| **Ad / tracker blocking** | Server blocks known ad / tracker hostnames | Resolve a handful of known trackers; count those that fail or resolve to `0.0.0.0` |
| **DNS-over-HTTPS reachable** | DoH endpoint responds correctly | RFC 8484 wire-format query over HTTPS |

## Configuration & data files

`bestdns` stores its data in the standard per-OS config directory:

| OS | Location |
| --- | --- |
| macOS | `~/Library/Preferences/bestdns/` |
| Linux | `$XDG_CONFIG_HOME/bestdns/` or `~/.config/bestdns/` |
| Windows | `%APPDATA%\bestdns\Config\` |

Files:

- `config.json` — app settings (last benchmark winner, preferred category)
- `custom-providers.json` — user-added DNS providers
- `backups.json` — last 50 DNS snapshots captured before each `apply` (used by
  `restore`)

Everything is plain JSON — safe to inspect, edit, or back up.

## Platform support

| OS | Read DNS | Apply DNS | Mechanism |
| --- | --- | --- | --- |
| **macOS** | ✓ | ✓ | `networksetup` |
| **Linux** | ✓ | ✓ | `nmcli` (NetworkManager) → `resolvectl` (systemd-resolved) → `/etc/resolv.conf` |
| **Windows** | ✓ | ✓ | PowerShell `DnsClient` cmdlets, elevated via UAC |

`apply` always:

1. **Backs up** the current DNS configuration first.
2. **Asks** for confirmation (unless `--yes`).
3. **Elevates** only the mutation step — never the whole process.
4. **Shows** the exact command it ran (and you can preview with `--dry-run`).

## How it works

- **Benchmark** — for each provider's primary IPv4 it creates a [`node:dns`
  Resolver](https://nodejs.org/api/dns.html#new-dnsresolveroptions) pinned to that
  server, resolves a fixed set of test domains plus one guaranteed cache-miss random
  domain over multiple rounds, and computes `avg + jitter + reliability` into a
  composite score (lower is better).
- **Health** — DNSSEC, NXDOMAIN-hijacking, and ad-block tests use the same Resolver;
  the DoH check sends a real RFC 8484 wire-format query so it works against every
  provider, not just the ones with a JSON API.
- **Apply** — per-OS backends build the appropriate command, spawn it via
  `sudo`/`Start-Process -Verb RunAs` if needed, and verify by re-reading the DNS
  setting.

The whole thing is bundled with [Bun](https://bun.sh) and shipped as a single
Node-compatible JS file, so `npx bestdns` works on any Node ≥ 18 with no dependencies
to install.

## Development

Prerequisites: [Bun](https://bun.sh) ≥ 1.3, Node ≥ 18.

```bash
git clone https://github.com/hashcott/bestdns.git
cd bestdns
bun install

bun run dev          # run the CLI from source
bun test             # run the test suite
bun run typecheck    # type-check with tsc
bun run lint         # lint & format check with Biome
bun run lint:fix     # auto-fix lint / formatting
bun run build        # bundle to dist/bestdns.js
```

### Project layout

```text
src/
├── index.ts            entry, update-notifier, router
├── cli.ts              commander program (subcommands + flags)
├── menu.ts             interactive clack menu
├── commands/           one file per top-level command
├── core/               resolver, benchmark, health, doh
├── os/                 macos / linux / windows backends
├── store/              config, custom providers, backups
├── data/providers.ts   built-in DNS catalog
└── ui/                 theme, tables, prompts
```

## Contributing

PRs and issues are very welcome. A few guidelines:

1. **Commit using [Conventional Commits](https://www.conventionalcommits.org/).** A
   Husky `commit-msg` hook validates this locally; `semantic-release` reads the same
   history to decide version bumps.
   - `fix:` → patch
   - `feat:` → minor
   - `feat!:` or `BREAKING CHANGE:` → major
   - `chore:` / `docs:` / `ci:` / `refactor:` / `test:` → no release
2. **Run `bun run lint && bun run typecheck && bun test`** before pushing. CI runs the
   same on Ubuntu, macOS and Windows.
3. **Keep commits focused.** One thing per commit; rebase / amend rather than "fixup"
   noise.
4. **Adding a provider?** Edit `src/data/providers.ts`, include a primary + secondary
   IPv4 (IPv6 / DoH / DoT if available), and add the entry to the README provider
   tables.

### Reporting bugs

Open an [issue](https://github.com/hashcott/bestdns/issues) with:

- Your OS and `bestdns --version`
- The command you ran and the output (`--json` output is great)
- For `apply` issues, the output of `bestdns apply <provider> --dry-run`

## Releasing (maintainers)

Releases are fully automated by
[semantic-release](https://github.com/semantic-release/semantic-release):

- Push a `feat:`/`fix:` commit to `main` → CI bumps the version, updates
  `CHANGELOG.md`, tags the release, publishes to npm and creates a GitHub release.
- No manual `npm publish`, no manual version bumps in `package.json`.

**One-time setup** (already done on this repo):

- `NPM_TOKEN` secret in *Settings → Secrets → Actions* (npm Automation or Granular
  token with publish rights).
- `repository`, `bugs`, `homepage` in `package.json` pointing at the GitHub repo.

## Roadmap

Ideas welcome — open an issue if you want to take any of these on:

- [x] End-to-end network optimization flow (`optimize`) — shipped in 1.1.0
- [x] Read-only diagnostic mode (`diagnose`) — shipped in 1.1.0
- [ ] Wi-Fi info on modern macOS via `wdutil` / `SPAirPortDataType` JSON
      (`airport -I` was removed in recent versions)
- [ ] Bandwidth-hog process listing (`nettop` / `nethogs` / `Get-NetTCPConnection`)
- [ ] Network locations / Wi-Fi profile cleanup helpers
- [ ] DoT / DoH apply on macOS via configuration profiles
- [ ] DoH benchmarking as a first-class result column
- [ ] Per-network-profile presets ("work", "home", "travel")
- [ ] Per-domain forwarding rules
- [ ] Watch mode that re-benchmarks when the network changes
- [ ] Web UI (`bestdns serve`) for a local dashboard

## Acknowledgments

Built with the help of these excellent open-source projects:

- [Bun](https://bun.sh) — runtime, bundler, package manager and test runner
- [@clack/prompts](https://github.com/bombshell-dev/clack) — beautiful CLI prompts
- [commander](https://github.com/tj/commander.js) — argument parsing
- [cli-table3](https://github.com/cli-table/cli-table3) — terminal tables
- [picocolors](https://github.com/alexeyraspopov/picocolors) — tiny color library
- [semantic-release](https://github.com/semantic-release/semantic-release) — automated
  releases
- [Biome](https://biomejs.dev) — lint + formatter
- [AdGuard DNS knowledge base](https://adguard-dns.io/kb/general/dns-providers/) —
  taxonomy and addresses for the built-in catalog

## License

[MIT](./LICENSE) © bestdns contributors
