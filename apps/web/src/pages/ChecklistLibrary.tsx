import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

interface ChecklistItemView {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done";
}

export function ChecklistLibrary() {
  const { user } = useAuth();
  const teamId = user?.teamId;
  const [items, setItems] = useState<ChecklistItemView[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto mt-12 max-w-2xl">
      <h1 className="text-xl font-semibold">Checklist library</h1>
      {error && <p role="alert">{error}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={item.status === "done"} onChange={() => toggle(item)} />
              {item.title}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
