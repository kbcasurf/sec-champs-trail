import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type Bucket = "three_months" | "six_months" | "twelve_months";

interface ActionItemView {
  checklistItemId: string;
  bucket: Bucket;
  status: string;
  checklistItem: { title: string };
}

interface ActionPlanView {
  id: string;
  actionItems: ActionItemView[];
}

const BUCKET_LABELS: Record<Bucket, string> = {
  three_months: "3 months",
  six_months: "6 months",
  twelve_months: "12 months",
};

const BUCKETS: Bucket[] = ["three_months", "six_months", "twelve_months"];

export function ActionPlanPage() {
  const { user } = useAuth();
  const teamId = user?.teamId;
  const [plan, setPlan] = useState<ActionPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan() {
    if (!teamId) return;
    const res = await apiFetch(`/teams/${teamId}/action-plans/latest`);
    if (!res.ok) {
      setPlan(null);
      setError("No action plan yet — generate one from your latest assessment.");
      return;
    }
    setError(null);
    setPlan(await res.json());
  }

  useEffect(() => {
    loadPlan();
  }, [teamId]);

  async function handleGenerate() {
    if (!teamId) return;
    const res = await apiFetch(`/teams/${teamId}/action-plans`, { method: "POST" });
    if (res.ok) {
      await loadPlan();
    } else {
      setError("Failed to generate action plan. Please try again.");
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-2xl">
      <h1 className="text-xl font-semibold">Action plan</h1>
      <button onClick={handleGenerate}>Generate new plan</button>
      {error && <p role="alert">{error}</p>}
      {plan &&
        BUCKETS.map((bucket) => (
          <section key={bucket}>
            <h2>{BUCKET_LABELS[bucket]}</h2>
            <ul>
              {plan.actionItems
                .filter((item) => item.bucket === bucket)
                .map((item) => (
                  <li key={item.checklistItemId}>
                    {item.checklistItem.title} — {item.status}
                  </li>
                ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
