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

const BUCKET_TRACK_COLOR: Record<Bucket, string> = {
  three_months: "bg-accent",
  six_months: "bg-info",
  twelve_months: "bg-success",
};

const STATUS_LABEL: Record<string, string> = { pending: "Pending", in_progress: "In progress", done: "Done" };
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-surface-2 text-ink-muted",
  in_progress: "bg-info-soft text-info",
  done: "bg-success-soft text-success",
};

const BUCKETS: Bucket[] = ["three_months", "six_months", "twelve_months"];

interface Team {
  id: string;
  name: string;
}

export function ActionPlanPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string | null>(user?.teamId ?? null);
  const [plan, setPlan] = useState<ActionPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") {
      apiFetch("/teams").then(async (res) => {
        if (!res.ok) return;
        setTeams(await res.json());
      });
    }
  }, [user]);

  // `user` is still null on first render (the AuthProvider's `/auth/me` fetch is async),
  // so the `useState(user?.teamId ?? null)` initializer above misses a champion's team
  // once it resolves. Sync it here once the user is known.
  useEffect(() => {
    if (user?.teamId) {
      setTeamId(user.teamId);
    }
  }, [user]);

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
    setPlan(null);
    setError(null);
    loadPlan();
  }, [teamId]);

  async function handleGenerate() {
    if (!teamId) return;
    setGenerating(true);
    const res = await apiFetch(`/teams/${teamId}/action-plans`, { method: "POST" });
    if (res.ok) {
      await loadPlan();
    } else {
      setError("Failed to generate action plan. Please try again.");
    }
    setGenerating(false);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-16 pt-10">
      <div className="mb-7 flex items-end justify-between gap-6">
        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Prioritized roadmap</p>
          <h1 className="font-display text-2xl font-bold text-ink">Action plan</h1>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === "admin" && (
            <div className="relative flex-none">
              <select
                value={teamId ?? ""}
                onChange={(e) => setTeamId(e.target.value)}
                className="appearance-none rounded-lg border border-line bg-surface py-2.5 pl-3.5 pr-9 font-mono text-xs text-ink outline-none"
              >
                <option value="" disabled>
                  Select a team
                </option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !teamId}
            className="flex items-center gap-2 rounded-lg bg-accent px-4.5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={generating ? "animate-spin" : ""}
            >
              {generating ? <path d="M21 12a9 9 0 1 1-2.6-6.4" /> : <path d="M4 19V6a1 1 0 0 1 1-1h8l6 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />}
            </svg>
            Generate new plan
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-line bg-surface p-16 text-center font-body text-[13.5px] text-ink-body">
          {error}
        </p>
      )}

      {plan && (
        <div className="grid grid-cols-3 gap-4.5">
          {BUCKETS.map((bucket) => {
            const bucketItems = plan.actionItems.filter((item) => item.bucket === bucket);
            return (
              <div key={bucket}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-[14.5px] font-semibold text-accent">{BUCKET_LABELS[bucket]}</h2>
                  <span className="font-mono text-[11px] text-ink-muted">{bucketItems.length} items</span>
                </div>
                <div className="mb-3.5 h-[3px] overflow-hidden rounded bg-surface-2">
                  <div className={`h-full w-full rounded ${BUCKET_TRACK_COLOR[bucket]}`} />
                </div>
                <ul className="flex flex-col gap-2.5">
                  {bucketItems.map((item) => (
                    <li key={item.checklistItemId} className="rounded-[10px] border border-line bg-surface p-3.5">
                      <p className="mb-2 font-body text-[12.5px] leading-snug text-ink-body">{item.checklistItem.title}</p>
                      <span className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide ${STATUS_CLASS[item.status]}`}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
