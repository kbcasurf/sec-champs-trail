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

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-12 max-w-2xl">
      <h1 className="text-xl font-semibold">Program maturity assessment</h1>
      {principles.map((p) => (
        <fieldset key={p.id}>
          <legend>{p.title}</legend>
          {p.maturityLevels.map((lvl) => (
            <label key={lvl.level}>
              <input
                type="radio"
                name={p.id}
                value={lvl.level}
                checked={scores[p.id] === lvl.level}
                onChange={() => setScores((s) => ({ ...s, [p.id]: lvl.level }))}
              />
              {lvl.level} — {lvl.description}
            </label>
          ))}
        </fieldset>
      ))}
      <button type="submit">Submit assessment</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
