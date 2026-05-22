import { join } from "node:path";
import envPaths from "env-paths";

/**
 * Cross-platform application directories.
 * - macOS:   ~/Library/Preferences/bestdns
 * - Linux:   ~/.config/bestdns       (respects $XDG_CONFIG_HOME)
 * - Windows: %APPDATA%\bestdns\Config
 */
const paths = envPaths("bestdns", { suffix: "" });

/** Directory holding all persisted bestdns state. */
export const CONFIG_DIR = paths.config;

/** General application settings (last benchmark, preferences). */
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

/** User-added DNS providers. */
export const CUSTOM_PROVIDERS_FILE = join(CONFIG_DIR, "custom-providers.json");

/** History of DNS settings captured before a change, for restore. */
export const BACKUPS_FILE = join(CONFIG_DIR, "backups.json");
