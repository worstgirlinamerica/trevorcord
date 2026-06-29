# TrevorCord

TrevorCord is a small standalone Discord desktop mod. The first feature is a configurable GIF provider rewrite so Discord GIF search can be routed to Klipy, Tenor, or Giphy.

It patches Discord's downloaded `discord_desktop_core/core.asar`, creates a backup next to it, and injects a small Electron hook. It does not depend on Vencord.

## Easy Install

For people who do not want to use a terminal, download the latest TrevorCord Installer from GitHub Releases:

- macOS: open the `.dmg`, launch TrevorCord Installer, then click **Patch Discord**
- Windows: run the `.exe` installer, launch TrevorCord Installer, then click **Patch Discord**

Fully quit Discord and reopen it after patching. TrevorCord appears inside Discord's own settings sidebar.

## Script Install

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/worstgirlinamerica/trevorcord/main/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/worstgirlinamerica/trevorcord/main/install.ps1 | iex
```

Requirements:

- Discord desktop app
- Node.js 18 or newer

Fully quit Discord and reopen it after installing.

## GUI Development

```bash
npm install
npm run gui
```

Release builds are created by GitHub Actions when a `v*` tag is pushed. The workflow builds a macOS `.dmg` and Windows `.exe`.

## Commands

```bash
npm run install-mod
npm run status
npm run restore
```

After installing or restoring, fully quit Discord and reopen it.

## Settings

The injected mod creates:

```json
{
  "gifProviderRewriteEnabled": true,
  "gifProvider": "klipy"
}
```

The file lives inside Discord's user data folder at `trevorcord/settings.json`. You can change these from the TrevorCord page inside Discord settings after patching.

You can also set values from the terminal:

```bash
node bin/trevorcord.js set gifProvider klipy
node bin/trevorcord.js set gifProviderRewriteEnabled true
```

## Cross-platform target

The patcher searches common Discord desktop module locations on macOS, Windows, and Linux:

- macOS: `~/Library/Application Support/discord`
- Windows: `%APPDATA%\\discord`
- Linux: `~/.config/discord`

Canary and PTB user data folders are included too.

## Uninstall

macOS / Linux:

```bash
node ~/.trevorcord/bin/trevorcord.js restore
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE\.trevorcord\bin\trevorcord.js" restore
```

Then fully quit and reopen Discord.
