export type ActionBucket = "three_months" | "six_months" | "twelve_months";

export interface PrincipleScoreInput {
  principleId: string;
  principleOrder: number;
  score: number;
}

export interface ChecklistItemInput {
  id: string;
  principleId: string;
}

export interface GeneratedActionItem {
  checklistItemId: string;
  bucket: ActionBucket;
}

export function generateActionItems(
  scores: PrincipleScoreInput[],
  checklistItems: ChecklistItemInput[],
): GeneratedActionItem[] {
  const ranked = [...scores].sort((a, b) => a.score - b.score || a.principleOrder - b.principleOrder);

  const bucketByPrincipleId = new Map<string, ActionBucket>();
  const principleIndex = new Map<string, number>();

  ranked.forEach((principle, index) => {
    const bucket: ActionBucket = index < 3 ? "three_months" : index < 6 ? "six_months" : "twelve_months";
    bucketByPrincipleId.set(principle.principleId, bucket);
    principleIndex.set(principle.principleId, index);
  });

  return checklistItems
    .filter((item) => bucketByPrincipleId.has(item.principleId))
    .sort((a, b) => (principleIndex.get(a.principleId) || 0) - (principleIndex.get(b.principleId) || 0))
    .map((item) => ({ checklistItemId: item.id, bucket: bucketByPrincipleId.get(item.principleId)! }));
}
