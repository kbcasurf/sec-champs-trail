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
    <div className="mx-auto mt-12 max-w-2xl">
      <h1 className="text-xl font-semibold">Teams</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleCreateTeam}>
        <label htmlFor="team-name">New team name</label>
        <input id="team-name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
        <button type="submit">Create team</button>
      </form>
      <ul>
        {teams.map((t) => (
          <li key={t.id}>
            <button onClick={() => handleSelectTeam(t.id)}>{t.name}</button>
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <h2>{selected.name}</h2>
          <ul>
            {selected.champions.map((c) => (
              <li key={c.id}>
                {c.email} ({c.role})
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateChampion}>
            <label htmlFor="champion-email">Email</label>
            <input
              id="champion-email"
              type="email"
              value={newChampionEmail}
              onChange={(e) => setNewChampionEmail(e.target.value)}
            />
            <label htmlFor="champion-password">Password</label>
            <input
              id="champion-password"
              type="password"
              value={newChampionPassword}
              onChange={(e) => setNewChampionPassword(e.target.value)}
            />
            <button type="submit">Add champion to {selected.name}</button>
          </form>
        </div>
      )}
    </div>
  );
}
