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

const PHASE_LABELS: Record<ChecklistItemView["phase"], string> = {
  recruitment: "Recruitment",
  development_retention: "Development & Retention",
};

const PHASES: ChecklistItemView["phase"][] = ["recruitment", "development_retention"];

export function ChecklistLibrary() {
  const { user } = useAuth();
  const teamId = user?.teamId;
  const [items, setItems] = useState<ChecklistItemView[]>([]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/principles").then(async (res) => {
      if (!res.ok) return;
      setPrinciples(await res.json());
    });
  }, []);

  useEffect(() => {
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
    <div className="mx-auto mt-12 max-w-2xl">
      <h1 className="text-xl font-semibold">Checklist library</h1>
      {error && <p role="alert">{error}</p>}
      {PHASES.map((phase) => {
        const itemsInPhase = items.filter((i) => i.phase === phase);
        if (itemsInPhase.length === 0) return null;

        const principleIdsInPhase = Array.from(new Set(itemsInPhase.map((i) => i.principleId)));

        return (
          <section key={phase}>
            <h2>{PHASE_LABELS[phase]}</h2>
            {principleIdsInPhase.map((principleId) => (
              <div key={principleId}>
                <h3>{principleTitleById.get(principleId) ?? principleId}</h3>
                <ul>
                  {itemsInPhase
                    .filter((i) => i.principleId === principleId)
                    .map((item) => (
                      <li key={item.id}>
                        <label>
                          <input type="checkbox" checked={item.status === "done"} onChange={() => toggle(item)} />
                          {item.title}
                        </label>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
