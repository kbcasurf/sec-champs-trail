import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

interface MaturityLevel {
  level: number;
  description: string;
}

interface PrincipleWithLevels {
  id: string;
  title: string;
  maturityLevels: MaturityLevel[];
}

export function AssessmentForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [principles, setPrinciples] = useState<PrincipleWithLevels[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<{ principleId: string; level: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/principles").then(async (res) => {
      if (!res.ok) return;
      setPrinciples(await res.json());
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const teamId = user?.teamId;
    if (!teamId) {
      setError("You must belong to a team to submit an assessment.");
      return;
    }

    const payload = { scores: principles.map((p) => ({ principleId: p.id, score: scores[p.id] ?? 0 })) };
    const res = await apiFetch(`/teams/${teamId}/assessments`, { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) {
      setError("Could not submit assessment.");
      return;
    }
    navigate("/dashboard");
  }

  const answeredCount = principles.filter((p) => scores[p.id] !== undefined).length;
  const total = principles.length;
  const canSubmit = total > 0 && answeredCount === total;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[760px] px-8 pb-24 pt-10">
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">New snapshot</p>
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Program maturity assessment</h1>
      <p className="mb-6 font-body text-[13px] text-ink-muted">
        Answer all {total || 10} principles on a 0–4 scale. Retaking this assessment later creates a new historical snapshot — it never
        overwrites this one.
      </p>

      <div className="sticky top-4 z-10 mb-7 flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
        <span className="whitespace-nowrap font-mono text-xs text-ink-body">
          <b className="text-accent">{answeredCount}</b> / {total || 10} answered
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-surface-2">
          <div className="h-full rounded bg-accent transition-[width]" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
        </div>
      </div>

      {principles.map((p, idx) => {
        const answered = scores[p.id] !== undefined;
        const activeLevel = hover?.principleId === p.id ? hover.level : answered ? scores[p.id] : null;
        const activeDescription = activeLevel !== null ? p.maturityLevels.find((l) => l.level === activeLevel)?.description : null;
        return (
          <fieldset key={p.id} className="mb-3.5 rounded-2xl border border-line bg-surface p-5 pb-5">
            <div className="mb-3.5 flex items-center gap-3">
              <span
                className={`flex h-6.5 w-6.5 flex-none items-center justify-center rounded-md border font-mono text-xs font-semibold ${
                  answered ? "border-accent bg-accent text-accent-text" : "border-accent-border bg-accent-soft text-accent"
                }`}
              >
                {idx + 1}
              </span>
              <legend className="font-display text-[15.5px] font-semibold text-ink">{p.title}</legend>
            </div>
            <div className="mb-3.5 flex gap-2">
              {p.maturityLevels.map((lvl) => {
                const selected = scores[p.id] === lvl.level;
                return (
                  <label
                    key={lvl.level}
                    className={`flex h-9 w-10 cursor-pointer items-center justify-center rounded-lg border font-mono text-[13px] font-semibold ${
                      selected ? "border-accent bg-accent text-accent-text" : "border-line bg-bg-elevated text-ink-muted hover:border-ink-muted-2 hover:text-ink"
                    }`}
                    onMouseEnter={() => setHover({ principleId: p.id, level: lvl.level })}
                    onMouseLeave={() => setHover((h) => (h?.principleId === p.id ? null : h))}
                  >
                    <input
                      type="radio"
                      name={p.id}
                      value={lvl.level}
                      checked={selected}
                      onChange={() => setScores((s) => ({ ...s, [p.id]: lvl.level }))}
                      aria-label={`${lvl.level} — ${lvl.description}`}
                      className="sr-only-label"
                    />
                    {lvl.level}
                  </label>
                );
              })}
            </div>
            <div
              className={`rounded-lg border border-line-soft bg-bg-elevated px-3.5 py-3 font-body text-[12.5px] leading-relaxed ${
                activeDescription ? "text-ink-body" : "text-ink-muted-2"
              }`}
            >
              {activeDescription ?? "Select a maturity level above to see its description."}
            </div>
          </fieldset>
        );
      })}

      <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-bg from-60% pb-1 pt-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-accent px-5.5 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted-2"
        >
          Submit assessment
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 font-body text-[12.5px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
