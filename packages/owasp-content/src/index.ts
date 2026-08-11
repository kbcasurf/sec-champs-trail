import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ChecklistItem, Principle } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
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
