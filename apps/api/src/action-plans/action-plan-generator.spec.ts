import { generateActionItems } from "./action-plan-generator";

function principle(principleId: string, principleOrder: number, score: number) {
  return { principleId, principleOrder, score };
}

describe("generateActionItems", () => {
  it("splits 10 ranked principles into buckets of 3/3/4", () => {
    const scores = Array.from({ length: 10 }, (_, i) => principle(`p${i}`, i + 1, i)); // scores 0..9, already ascending
    const checklistItems = scores.map((s) => ({ id: `item-${s.principleId}`, principleId: s.principleId }));

    const result = generateActionItems(scores, checklistItems);

    const byBucket = (bucket: string) => result.filter((r) => r.bucket === bucket).map((r) => r.checklistItemId);
    expect(byBucket("three_months")).toEqual(["item-p0", "item-p1", "item-p2"]);
    expect(byBucket("six_months")).toEqual(["item-p3", "item-p4", "item-p5"]);
    expect(byBucket("twelve_months")).toEqual(["item-p6", "item-p7", "item-p8", "item-p9"]);
  });

  it("breaks score ties using principleOrder ascending", () => {
    const scores = [principle("a", 2, 1), principle("b", 1, 1)]; // same score, b has lower order
    const checklistItems = [
      { id: "item-a", principleId: "a" },
      { id: "item-b", principleId: "b" },
    ];

    const result = generateActionItems(scores, checklistItems);
    const firstBucketItems = result.filter((r) => r.bucket === "three_months").map((r) => r.checklistItemId);
    expect(firstBucketItems).toEqual(["item-b", "item-a"]);
  });

  it("maps every checklist item to the bucket of its own principle", () => {
    const scores = [principle("weak", 1, 0), principle("strong", 2, 4)];
    const checklistItems = [
      { id: "weak-item-1", principleId: "weak" },
      { id: "weak-item-2", principleId: "weak" },
      { id: "strong-item-1", principleId: "strong" },
    ];

    const result = generateActionItems(scores, checklistItems);
    expect(result.find((r) => r.checklistItemId === "weak-item-1")?.bucket).toBe("three_months");
    expect(result.find((r) => r.checklistItemId === "weak-item-2")?.bucket).toBe("three_months");
    expect(result.find((r) => r.checklistItemId === "strong-item-1")?.bucket).toBe("three_months");
    // note: with only 2 principles, both fall in the first 3 ranked slots — see Step 3 comment.
  });
});
