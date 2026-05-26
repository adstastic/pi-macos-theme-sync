# pi-macos-theme-sync

Pi extension that syncs Pi's theme with macOS light/dark appearance.

No polling. It watches macOS appearance notifications plus `~/Library/Preferences/.GlobalPreferences.plist` changes via filesystem events, emits `dark` or `light`, then Pi calls `ctx.ui.setTheme()`.

## Install

From npm:

```bash
pi install npm:pi-macos-theme-sync
```

Try without installing:

```bash
pi -e npm:pi-macos-theme-sync
```

From this repository:

```bash
npm install
npm run build
pi -e ./src/index.ts
```

Or install/use it as a Pi package from a local path:

```bash
pi install /absolute/path/to/pi-macos-theme-sync
```

## Use

Sync starts automatically on Pi session start.

Commands:

```text
/pi-macos-theme-sync status
/pi-macos-theme-sync sync
/pi-macos-theme-sync debug
/pi-macos-theme-sync start
/pi-macos-theme-sync stop
/pi-macos-theme-sync restart
```

Default mapping:

- macOS dark mode → Pi `dark` theme
- macOS light mode → Pi `light` theme

Override theme names with env vars:

```bash
PI_MACOS_THEME_SYNC_DARK=tokyo-night \
PI_MACOS_THEME_SYNC_LIGHT=github-light \
pi -e ./src/index.ts
```

## Requirements

- macOS
- Swift CLI available as `swift` (usually via Xcode Command Line Tools)
- Pi interactive/RPC UI mode

## Behavior

- On startup, watcher emits current macOS appearance once.
- On macOS appearance notification, watcher emits next mode.
- On wake/unlock/screensaver stop, watcher re-emits current mode to catch scheduled changes that happened during sleep.
- On `.GlobalPreferences.plist` filesystem change, extension re-reads current mode to catch flips when notifications do not reach Pi.
- `sync` immediately re-reads macOS appearance and applies matching Pi theme.
- `debug` reports macOS mode, Pi theme, Swift watcher PID, filesystem watcher count, and configured theme names.
- Extension keeps a footer status like `macOS:dark sync:on`.
- In non-macOS environments, extension no-ops with a warning.
