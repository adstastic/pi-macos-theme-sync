# macos-theme-sync

Pi extension that syncs Pi's theme with macOS light/dark appearance.

No polling. It starts a tiny Swift watcher that subscribes to macOS `AppleInterfaceThemeChangedNotification`, emits `dark` or `light`, then Pi calls `ctx.ui.setTheme()`.

## Install

From npm:

```bash
pi install npm:macos-theme-sync
```

Try without installing:

```bash
pi -e npm:macos-theme-sync
```

From this repository:

```bash
npm install
npm run build
pi -e ./src/index.ts
```

Or install/use it as a Pi package from a local path:

```bash
pi install /absolute/path/to/macos-theme-sync
```

## Use

Sync starts automatically on Pi session start.

Commands:

```text
/macos-theme-sync status
/macos-theme-sync start
/macos-theme-sync stop
/macos-theme-sync restart
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
- On macOS appearance change, watcher emits next mode.
- Extension keeps a footer status like `macOS:dark sync:on`.
- In non-macOS environments, extension no-ops with a warning.
