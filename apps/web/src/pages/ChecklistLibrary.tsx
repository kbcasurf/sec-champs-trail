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

  useEffect(() => {
    if (!teamId) return;
    apiFetch(`/teams/${teamId}/checklist-progress`)
      .then((res) => res.json())
      .then(setItems);
  }, [teamId]);

  async function toggle(item: ChecklistItemView) {
    const nextStatus = item.status === "done" ? "pending" : "done";
    await apiFetch(`/teams/${teamId}/checklist-progress/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)));
  }

  return (
    <div className="mx-auto mt-12 max-w-2xl">
      <h1 className="text-xl font-semibold">Checklist library</h1>
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
