# ⚡ bestdns

> Find the fastest, safest DNS for your network — then apply it in one step.

`bestdns` is a cross-platform command-line tool that benchmarks public DNS
providers, ranks them by real-world speed and reliability, and can apply the
winner to your operating system's network settings automatically. It also runs
capability checks (DNSSEC, NXDOMAIN-hijacking, ad-blocking, DNS-over-HTTPS) and
lets you manage your own catalog of providers.

Works on **macOS**, **Linux** and **Windows**.

```bash
npx bestdns
```

---

## ✨ Features

- 🔍 **Benchmark** — measures latency, jitter and reliability across a curated
  catalog of public resolvers and ranks them fastest-first.
- ⚡ **Auto** — benchmark and apply the fastest provider in a single command.
- 🎯 **Apply** — set DNS for your active network service, cross-platform, with
  privilege elevation handled for you (`sudo` / UAC).
- 📡 **Current** — show the DNS each network service is using and identify the
  provider behind it.
- 🩺 **Health checks** — DNSSEC validation, NXDOMAIN-hijacking detection,
  ad/tracker blocking and DNS-over-HTTPS reachability.
- 📋 **Catalog management** — browse built-in providers grouped into
  *Non-filtering*, *Security & Ad-blocking* and *Family-safe*, and add your own.
- ↩️ **Backup & restore** — your previous DNS is saved before every change;
  revert to automatic (DHCP) with one command.
- 🔄 **Update checker** — tells you when a newer version is available.
- 🖥️ **Beautiful UX** — an interactive menu when run with no arguments, plus a
  fully scriptable flag-based interface (with `--json`).

## 🚀 Quick start

Run it instantly, no install required:

```bash
npx bestdns
```

Or install it globally:

```bash
npm install -g bestdns
bestdns
```

Running `bestdns` with no arguments opens the interactive menu.

## 🧭 Commands

| Command | Description |
| --- | --- |
| `bestdns` | Open the interactive menu |
| `bestdns auto` | Benchmark every provider and apply the fastest |
| `bestdns benchmark` | Benchmark providers and rank them by speed |
| `bestdns apply <provider>` | Apply a DNS provider to your network |
| `bestdns current` | Show the current DNS configuration |
| `bestdns health [provider]` | Check DNSSEC, hijacking, ad-blocking and DoH |
| `bestdns list` | Browse and manage the provider catalog |
| `bestdns restore` | Restore DNS to automatic (DHCP) |

### Useful flags

```bash
bestdns benchmark --group security      # only ad-blocking / security resolvers
bestdns benchmark --top 5 --json        # fastest 5, machine-readable
bestdns apply cloudflare --dry-run      # preview the command, change nothing
bestdns apply quad9 --yes               # apply without a confirmation prompt
bestdns apply adguard --ipv6            # also configure IPv6
bestdns current --json                  # scriptable status output
bestdns list groups                      # show provider categories
bestdns list add                         # add a custom provider
```

## 🗂️ Provider groups

The catalog follows the taxonomy from the
[AdGuard DNS knowledge base](https://adguard-dns.io/kb/general/dns-providers/):

- **🚀 Non-filtering** — fastest, unfiltered resolvers (Cloudflare, Google,
  Quad9 Unfiltered, OpenDNS, …).
- **🛡️ Security & Ad-blocking** — block ads, trackers and malware (AdGuard DNS,
  Cloudflare Malware Blocking, Quad9, Mullvad, Control D, …).
- **👨‍👩‍👧 Family-safe** — also block adult content (AdGuard Family,
  Cloudflare for Families, CleanBrowsing Family, OpenDNS FamilyShield).

## 🔐 How "apply" works

Changing DNS requires administrator privileges. `bestdns`:

- **macOS** — uses `networksetup`, elevating with `sudo` (you'll be prompted for
  your password).
- **Linux** — detects NetworkManager (`nmcli`), then systemd-resolved
  (`resolvectl`), then `/etc/resolv.conf`, elevating with `sudo`.
- **Windows** — uses the PowerShell `DnsClient` cmdlets, raising a UAC prompt.

Your previous configuration is always backed up first, and `--dry-run` shows
the exact command without running it.

## 🛠️ Development

Requires [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install          # install dependencies
bun run dev          # run the CLI from source
bun test             # run the test suite
bun run typecheck    # type-check with tsc
bun run lint         # lint & format check with Biome
bun run build        # bundle to dist/bestdns.js
```

The CLI is written in TypeScript and developed with Bun, but the published
package is bundled for **Node.js** (`bun build --target=node`) so `npx bestdns`
works for everyone — no Bun required at runtime.

## 📦 Releasing

Releases are fully automated with
[semantic-release](https://github.com/semantic-release/semantic-release):

1. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `feat!:`, …). A Husky `commit-msg` hook validates this.
2. Merge to `main`. The **Release** workflow analyses the commits, bumps the
   version, updates `CHANGELOG.md`, tags the release, publishes to npm and
   creates a GitHub release.

**One-time repository setup:**

- Add an `NPM_TOKEN` secret (an npm automation token) under
  *Settings → Secrets and variables → Actions*.
- Update the `repository`, `bugs` and `homepage` fields in `package.json` to
  point at your GitHub repository.

## 📄 License

[MIT](./LICENSE)
