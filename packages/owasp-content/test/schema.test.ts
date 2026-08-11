import { describe, expect, it } from "vitest";
import { loadPrinciples, loadChecklistItems } from "../src/index";
import type { ChecklistPhase } from "../src/types";

const VALID_PHASES: ChecklistPhase[] = ["recruitment", "development-retention"];

describe("owasp-content loader mechanics", () => {
  it("loads principles sorted by their order field, each with attribution fields", () => {
    const principles = loadPrinciples();
    expect(principles.length).toBeGreaterThanOrEqual(1);

    const orders = principles.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));

    for (const p of principles) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.sourceUrl).toMatch(/^https:\/\/securitychampions\.owasp\.org\//);
      expect(p.license).toBe("CC BY-SA 4.0");
    }
  });

  it("loads checklist items that each reference a real principle and a valid phase", () => {
    const principles = loadPrinciples();
    const principleIds = new Set(principles.map((p) => p.id));
    const items = loadChecklistItems();

    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(principleIds.has(item.principleId)).toBe(true);
      expect(VALID_PHASES).toContain(item.phase);
      expect(item.sourceUrl).toMatch(/^https:\/\/securitychampions\.owasp\.org\//);
      expect(item.license).toBe("CC BY-SA 4.0");
    }
  });

  it("has exactly 10 curated principles, ordered 1-10", () => {
    const principles = loadPrinciples();
    expect(principles).toHaveLength(10);
    expect(principles.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
