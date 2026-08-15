import { useEffect, useState } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

interface Team {
  id: string;
  name: string;
}

interface PrincipleScoreView {
  score: number;
  principle: { id: string; title: string };
}

export function Dashboard() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string | null>(user?.teamId ?? null);
  const [scores, setScores] = useState<PrincipleScoreView[] | null>(null);
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
    if (!teamId) return;
    setError(null);
    setScores(null);
    apiFetch(`/teams/${teamId}/assessments/latest`).then(async (res) => {
      if (!res.ok) {
        setError("No assessment yet for this team.");
        return;
      }
      const data = await res.json();
      setScores(data.principleScores);
    });
  }, [teamId]);

  return (
    <div className="mx-auto mt-12 max-w-2xl">
      <h1 className="text-xl font-semibold">Program maturity</h1>
      {user?.role === "admin" && (
        <select value={teamId ?? ""} onChange={(e) => setTeamId(e.target.value)}>
          <option value="" disabled>
            Select a team
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      {error && <p role="alert">{error}</p>}
      {scores && (
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={scores.map((s) => ({ principle: s.principle.title, score: s.score }))}>
            <PolarGrid />
            <PolarAngleAxis dataKey="principle" />
            <PolarRadiusAxis domain={[0, 4]} />
            <Radar dataKey="score" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
