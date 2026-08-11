import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChecklistItem, Principle } from "./types";

// __dirname (not import.meta.url) so this file loads under both the
// package's own ESM test runner (Vite/Vitest shims __dirname for ESM)
// and CommonJS consumers like ts-jest in apps/api, where import.meta
// is not valid syntax.
const HERE = __dirname;
const PRINCIPLES_DIR = join(HERE, "..", "principles");
const CHECKLISTS_DIR = join(HERE, "..", "checklists");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function loadPrinciples(): Principle[] {
  return readdirSync(PRINCIPLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Principle>(join(PRINCIPLES_DIR, f)))
    .sort((a, b) => a.order - b.order);
}

export function loadChecklistItems(): ChecklistItem[] {
  return readdirSync(CHECKLISTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => readJson<ChecklistItem[]>(join(CHECKLISTS_DIR, f)));
}

export type { ChecklistItem, ChecklistPhase, Principle } from "./types";
