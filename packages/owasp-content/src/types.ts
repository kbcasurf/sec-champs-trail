export type ChecklistPhase = "recruitment" | "development-retention";

export interface Principle {
  id: string;
  order: number;
  title: string;
  description: string;
  sourceUrl: string;
  license: "CC BY-SA 4.0";
}

export interface ChecklistItem {
  id: string;
  principleId: string;
  phase: ChecklistPhase;
  title: string;
  description: string;
  sourceUrl: string;
  license: "CC BY-SA 4.0";
}
