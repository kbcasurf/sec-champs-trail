import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Team {
  id: string;
  name: string;
}

interface Champion {
  id: string;
  email: string;
  role: string;
}

interface TeamDetail extends Team {
  champions: Champion[];
}

export function TeamsAdmin() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<TeamDetail | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newChampionEmail, setNewChampionEmail] = useState("");
  const [newChampionPassword, setNewChampionPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadTeams() {
    const res = await apiFetch("/teams");
    if (!res.ok) {
      setError("Could not load teams.");
      return;
    }
    setTeams(await res.json());
  }

  useEffect(() => {
    loadTeams();
  }, []);

  async function handleCreateTeam(e: FormEvent) {
    e.preventDefault();
    const res = await apiFetch("/teams", { method: "POST", body: JSON.stringify({ name: newTeamName }) });
    if (!res.ok) {
      setError("Could not create team.");
      return;
    }
    setNewTeamName("");
    await loadTeams();
  }

  async function handleSelectTeam(id: string) {
    const res = await apiFetch(`/teams/${id}`);
    if (!res.ok) {
      setError("Could not load team details.");
      return;
    }
    setSelected(await res.json());
  }

  async function handleCreateChampion(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const res = await apiFetch("/champions", {
      method: "POST",
      body: JSON.stringify({ email: newChampionEmail, password: newChampionPassword, role: "champion", teamId: selected.id }),
    });
    if (!res.ok) {
      setError("Could not create champion.");
      return;
    }
    setNewChampionEmail("");
    setNewChampionPassword("");
    await handleSelectTeam(selected.id);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-16 pt-10">
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Organization administration</p>
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Teams</h1>
      <p className="mb-6 font-body text-[13px] text-ink-muted">
        Create teams and champions here. A champion always belongs to a team; admins can exist without one.
      </p>
      {error && (
        <p role="alert" className="mb-4 font-body text-[12.5px] text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-[340px_1fr] items-start gap-5">
        <div className="rounded-2xl border border-line bg-surface p-5.5">
          <h2 className="mb-1 font-display text-[14.5px] font-semibold text-ink">New team</h2>
          <p className="mb-4 font-body text-xs text-ink-muted">Create a team to group champions and their assessments.</p>
          <form onSubmit={handleCreateTeam}>
            <label htmlFor="team-name" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
              New team name
            </label>
            <input
              id="team-name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g. Payments Squad"
              className="mb-3 w-full rounded-lg border border-line bg-bg-elevated px-2.5 py-2 font-body text-[13px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-3.5 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover"
            >
              Create team
            </button>
          </form>

          <div className="mt-4.5 flex flex-col gap-1.5">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTeam(t.id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left font-body text-[13px] ${
                  selected?.id === t.id ? "border border-accent-border bg-accent-soft text-accent" : "border border-transparent text-ink-body hover:bg-surface-hover"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="rounded-2xl border border-line bg-surface p-5.5">
            <h2 className="mb-4.5 font-display text-[17px] font-bold text-ink">{selected.name}</h2>

            {selected.champions.length > 0 ? (
              <ul className="mb-5.5 flex flex-col gap-2">
                {selected.champions.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-bg-elevated px-3 py-2.5">
                    <span className="flex h-6.5 w-6.5 flex-none items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-ink-muted">
                      {c.email.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 font-mono text-[12.5px] text-ink-body">{c.email}</span>
                    <span className="flex-none rounded border border-accent-border bg-accent-soft px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-accent">
                      {c.role}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5.5 rounded-lg border border-dashed border-line py-3.5 text-center font-body text-[12.5px] text-ink-muted-2">
                No champions on this team yet.
              </p>
            )}

            <h2 className="mb-1 font-display text-[14.5px] font-semibold text-ink">Add champion to {selected.name}</h2>
            <p className="mb-3 font-body text-xs text-ink-muted">Assigns a new champion account to this team.</p>
            <form onSubmit={handleCreateChampion} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2.5">
              <div>
                <label htmlFor="champion-email" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
                  Email
                </label>
                <input
                  id="champion-email"
                  type="email"
                  value={newChampionEmail}
                  onChange={(e) => setNewChampionEmail(e.target.value)}
                  placeholder="name@org.com"
                  className="w-full rounded-lg border border-line bg-bg-elevated px-2.5 py-2 font-body text-[13px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
              </div>
              <div>
                <label htmlFor="champion-password" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
                  Password
                </label>
                <input
                  id="champion-password"
                  type="password"
                  value={newChampionPassword}
                  onChange={(e) => setNewChampionPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-line bg-bg-elevated px-2.5 py-2 font-body text-[13px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
              </div>
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 font-mono text-[11.5px] font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover"
              >
                Add champion
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
