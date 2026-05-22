import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Read and parse a JSON file, returning `fallback` if the file is missing
 * or corrupt. Persisted bestdns state is never critical enough to crash on.
 */
export function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Write `data` as pretty-printed JSON, creating parent directories. */
export function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
