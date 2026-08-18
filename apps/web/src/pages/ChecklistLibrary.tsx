import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

interface ChecklistItemView {
  id: string;
  principleId: string;
  phase: "recruitment" | "development_retention";
  title: string;
  status: "pending" | "in_progress" | "done";
}

interface Principle {
  id: string;
  title: string;
}

interface Team {
  id: string;
  name: string;
}

const PHASE_LABELS: Record<ChecklistItemView["phase"], string> = {
  recruitment: "Recruitment",
  development_retention: "Development & Retention",
};

const PHASES: ChecklistItemView["phase"][] = ["recruitment", "development_retention"];

export function ChecklistLibrary() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string | null>(user?.teamId ?? null);
  const [items, setItems] = useState<ChecklistItemView[]>([]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    apiFetch("/principles").then(async (res) => {
      if (!res.ok) return;
      setPrinciples(await res.json());
    });
  }, []);

  useEffect(() => {
    setError(null);
    setItems([]);
    if (!teamId) return;
    apiFetch(`/teams/${teamId}/checklist-progress`).then(async (res) => {
      if (!res.ok) {
        setError("Could not load checklist.");
        return;
      }
      setItems(await res.json());
    });
  }, [teamId]);

  async function toggle(item: ChecklistItemView) {
    const nextStatus = item.status === "done" ? "pending" : "done";
    const res = await apiFetch(`/teams/${teamId}/checklist-progress/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      setError("Could not update progress.");
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)));
  }

  const principleTitleById = new Map(principles.map((p) => [p.id, p.title]));

  return (
    <div className="mx-auto max-w-[820px] px-8 pb-20 pt-10">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">OWASP checklist library</p>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">Checklist library</h1>
          <p className="font-body text-[13px] text-ink-muted">
            Official checklists, browsable by principle and lifecycle phase. Progress here feeds the action plan and survives
            regeneration.
          </p>
        </div>
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
      </div>
      {error && (
        <p role="alert" className="mb-4 font-body text-[12.5px] text-danger">
          {error}
        </p>
      )}
      {PHASES.map((phase) => {
        const itemsInPhase = items.filter((i) => i.phase === phase);
        if (itemsInPhase.length === 0) return null;

        const principleIdsInPhase = Array.from(new Set(itemsInPhase.map((i) => i.principleId)));
        const doneCount = itemsInPhase.filter((i) => i.status === "done").length;

        return (
          <section key={phase} className="mb-7">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-semibold text-ink">{PHASE_LABELS[phase]}</h2>
              <span className="font-mono text-[11.5px] text-ink-muted">
                <b className="text-accent">{doneCount}</b> / {itemsInPhase.length} done
              </span>
            </div>
            <div className="mb-4 h-1 overflow-hidden rounded bg-surface-2">
              <div className="h-full rounded bg-accent" style={{ width: `${(doneCount / itemsInPhase.length) * 100}%` }} />
            </div>
            {principleIdsInPhase.map((principleId) => (
              <div key={principleId} className="mb-1">
                <h3 className="px-1 pb-2 pt-2.5 font-mono text-[10.5px] uppercase tracking-wide text-ink-muted-2">
                  {principleTitleById.get(principleId) ?? principleId}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {itemsInPhase
                    .filter((i) => i.principleId === principleId)
                    .map((item) => {
                      const done = item.status === "done";
                      return (
                        <li key={item.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 ${
                              done ? "border-line bg-surface" : "border-line bg-surface hover:border-ink-muted-2"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggle(item)}
                              className="peer sr-only-label"
                            />
                            <span
                              aria-hidden="true"
                              className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.5px] ${
                                done ? "border-success bg-success text-bg" : "border-ink-muted-2 text-transparent"
                              }`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                            <span className={`flex-1 font-body text-[13.5px] ${done ? "text-ink-muted line-through decoration-ink-muted-2" : "text-ink-body"}`}>
                              {item.title}
                            </span>
                            <span
                              className={`flex-none rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                                done ? "bg-success-soft text-success" : "bg-surface-2 text-ink-muted"
                              }`}
                            >
                              {done ? "Done" : "Pending"}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
