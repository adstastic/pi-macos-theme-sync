import { spawn, type ChildProcess } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const COMMAND_NAME = "macos-theme-sync";
const STATUS_KEY = "macos-theme-sync";
const DEFAULT_DARK_THEME = "dark";
const DEFAULT_LIGHT_THEME = "light";

const WATCHER_SOURCE = String.raw`
import Foundation
import Darwin

func currentMode() -> String {
  UserDefaults.standard.synchronize()
  let style = UserDefaults.standard.string(forKey: "AppleInterfaceStyle")
  return style == "Dark" ? "dark" : "light"
}

func emit() {
  print(currentMode())
  Darwin.fflush(Darwin.stdout)
}

emit()

let center = DistributedNotificationCenter.default()
let name = Notification.Name("AppleInterfaceThemeChangedNotification")
let token = center.addObserver(forName: name, object: nil, queue: .main) { _ in
  emit()
}

RunLoop.main.run()
_ = token
`;

type Mode = "dark" | "light";

function themeForMode(mode: Mode): string {
	const envName = mode === "dark" ? "PI_MACOS_THEME_SYNC_DARK" : "PI_MACOS_THEME_SYNC_LIGHT";
	const fallback = mode === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
	return process.env[envName]?.trim() || fallback;
}

function isMode(value: string): value is Mode {
	return value === "dark" || value === "light";
}

function formatStatus(mode: Mode | undefined, running: boolean): string {
	const modeLabel = mode ?? "unknown";
	const state = running ? "on" : "off";
	return `macOS:${modeLabel} sync:${state}`;
}

export default function (pi: ExtensionAPI) {
	let watcher: ChildProcess | undefined;
	let stopping = false;
	let lastMode: Mode | undefined;
	let stdoutBuffer = "";
	let stderrBuffer = "";

	function setStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		ctx.ui.setStatus(STATUS_KEY, formatStatus(lastMode, Boolean(watcher)));
	}

	function applyMode(mode: Mode, ctx: ExtensionContext): void {
		lastMode = mode;
		if (!ctx.hasUI) return;

		const themeName = themeForMode(mode);
		const result = ctx.ui.setTheme(themeName);
		if (!result.success) {
			ctx.ui.notify(`macOS theme sync failed: ${result.error ?? `unknown theme ${themeName}`}`, "error");
		}
		setStatus(ctx);
	}

	function handleStdout(data: Buffer | string, ctx: ExtensionContext): void {
		stdoutBuffer += data.toString();
		const lines = stdoutBuffer.split(/\r?\n/);
		stdoutBuffer = lines.pop() ?? "";

		for (const rawLine of lines) {
			const line = rawLine.trim().toLowerCase();
			if (isMode(line)) applyMode(line, ctx);
		}
	}

	function handleStderr(data: Buffer | string, ctx: ExtensionContext): void {
		stderrBuffer += data.toString();
		const lines = stderrBuffer.split(/\r?\n/);
		stderrBuffer = lines.pop() ?? "";
		const complete = lines.map((line) => line.trim()).filter(Boolean);
		if (complete.length > 0 && ctx.hasUI) {
			ctx.ui.notify(`macOS theme sync watcher: ${complete[complete.length - 1]}`, "warning");
		}
	}

	function start(ctx: ExtensionContext, announce = false): void {
		if (!ctx.hasUI) return;

		if (process.platform !== "darwin") {
			ctx.ui.notify("macOS theme sync only works on macOS", "warning");
			return;
		}

		if (watcher) {
			if (announce) ctx.ui.notify("macOS theme sync already running", "info");
			setStatus(ctx);
			return;
		}

		stopping = false;
		stdoutBuffer = "";
		stderrBuffer = "";

		const child = spawn("swift", ["-e", WATCHER_SOURCE], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		watcher = child;

		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (data) => handleStdout(data, ctx));
		child.stderr?.on("data", (data) => handleStderr(data, ctx));
		child.on("error", (error) => {
			if (watcher === child) watcher = undefined;
			if (ctx.hasUI) ctx.ui.notify(`macOS theme sync failed to start swift: ${error.message}`, "error");
			setStatus(ctx);
		});
		child.on("exit", (code, signal) => {
			if (watcher === child) watcher = undefined;
			if (!stopping && ctx.hasUI) {
				const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
				ctx.ui.notify(`macOS theme sync stopped: ${reason}`, "warning");
			}
			setStatus(ctx);
		});

		setStatus(ctx);
		if (announce) ctx.ui.notify("macOS theme sync started", "info");
	}

	function stop(ctx?: ExtensionContext, announce = false): void {
		const child = watcher;
		watcher = undefined;
		if (!child) {
			if (announce && ctx?.hasUI) ctx.ui.notify("macOS theme sync already stopped", "info");
			if (ctx?.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}

		stopping = true;
		child.kill();
		if (ctx?.hasUI) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			if (announce) ctx.ui.notify("macOS theme sync stopped", "info");
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		start(ctx);
	});

	pi.on("session_shutdown", async () => {
		stop();
	});

	pi.registerCommand(COMMAND_NAME, {
		description: "Sync pi theme with macOS light/dark appearance. Use /macos-theme-sync status|start|stop|restart.",
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase() || "status";

			if (action === "status") {
				ctx.ui.notify(
					`${formatStatus(lastMode, Boolean(watcher))}; light=${themeForMode("light")}; dark=${themeForMode("dark")}`,
					"info",
				);
				return;
			}

			if (action === "start") {
				start(ctx, true);
				return;
			}

			if (action === "stop") {
				stop(ctx, true);
				return;
			}

			if (action === "restart") {
				stop(ctx);
				start(ctx, true);
				return;
			}

			ctx.ui.notify(`usage: /${COMMAND_NAME} [status|start|stop|restart]`, "warning");
		},
	});
}
