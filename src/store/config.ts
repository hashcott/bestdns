import type { ProviderGroup } from "../types";
import { readJson, writeJson } from "./json-store";
import { CONFIG_FILE } from "./paths";

/** Persisted user settings and lightweight history. */
export interface AppConfig {
  /** Result of the most recent benchmark run. */
  lastBenchmark?: {
    at: string;
    bestId: string;
    bestName: string;
    avgMs: number;
  };
  /** Group the user most often benchmarks. */
  preferredGroup?: ProviderGroup;
}

/** Load the saved configuration (empty object when nothing is stored). */
export function loadConfig(): AppConfig {
  return readJson<AppConfig>(CONFIG_FILE, {});
}

/** Persist the configuration to disk. */
export function saveConfig(config: AppConfig): void {
  writeJson(CONFIG_FILE, config);
}
