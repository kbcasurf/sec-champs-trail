import { useEffect, useState } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function wrapLabel(text: string, maxCharsPerLine = 18): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface AxisTickProps {
  x?: number;
  y?: number;
  textAnchor?: "inherit" | "start" | "middle" | "end";
  payload?: { value: string };
}

function AxisTick({ x, y, payload, textAnchor }: AxisTickProps) {
  const lines = wrapLabel(payload?.value ?? "");
  const lineHeight = 12;
  const startDy = -((lines.length - 1) / 2) * lineHeight;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontSize={10.5} fill="#7d8798">
      {lines.map((line, i) => (
        <tspan key={line} x={x} dy={i === 0 ? startDy : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

interface RadarTooltipProps {
  active?: boolean;
  payload?: { payload: { principle: string; score: number } }[];
}

function RadarTooltip({ active, payload }: RadarTooltipProps) {
  if (!active || !payload?.length) return null;
  const { principle, score } = payload[0].payload;
  return (
    <div className="rounded-lg border border-accent-border bg-bg-elevated px-3 py-2 font-mono text-[11.5px] text-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]">
      {principle} — <span className="font-semibold text-accent">{score}/4</span>
    </div>
  );
}

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

  const avg = scores && scores.length > 0 ? (scores.reduce((a, s) => a + s.score, 0) / scores.length).toFixed(1) : null;

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-16 pt-10">
      <div className="mb-7 flex items-end justify-between gap-6">
        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Program maturity — 10 principles</p>
          <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
        </div>
        {user?.role === "admin" && (
          <div className="relative">
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
        <div className="rounded-2xl border border-line bg-surface p-16 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-ink-muted opacity-50">
            <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" />
            <path d="M12 8v8M8 12h8" opacity="0.5" />
          </svg>
          <p role="alert" className="font-body text-[13.5px] text-ink-body">
            {error}
          </p>
        </div>
      )}

      {scores && (
        <div className="grid grid-cols-[1.3fr_0.9fr] gap-5">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-1 font-display text-[15px] font-semibold text-ink">Maturity radar</h2>
            <p className="mb-2 font-body text-xs text-ink-muted">Most recent submission</p>
            <ResponsiveContainer width="100%" height={420}>
              <RadarChart
                data={scores.map((s) => ({ principle: s.principle.title, score: s.score }))}
                outerRadius="60%"
                margin={{ top: 28, right: 84, bottom: 28, left: 84 }}
              >
                <PolarGrid stroke="#232a34" />
                <PolarAngleAxis dataKey="principle" tick={<AxisTick />} />
                <PolarRadiusAxis domain={[0, 4]} axisLine={false} tick={false} />
                <Radar dataKey="score" stroke="#f97316" fill="#f97316" fillOpacity={0.22} strokeWidth={2} dot={{ r: 4, fill: "#f97316", stroke: "#0a0d12", strokeWidth: 1.5 }} />
                <Tooltip content={<RadarTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
            <div>
              <h2 className="mb-1 font-display text-[15px] font-semibold text-ink">Snapshot</h2>
              <p className="font-body text-xs text-ink-muted">Average across all principles</p>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl font-bold text-ink">{avg}</span>
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">/ 4.0 avg</span>
            </div>
            <div className="mt-1 flex flex-col gap-2.5">
              {scores.map((s) => (
                <div key={s.principle.id} className="grid grid-cols-[96px_1fr_22px] items-center gap-2.5">
                  <span className="truncate font-mono text-[10.5px] text-ink-muted" title={s.principle.title}>
                    {s.principle.title}
                  </span>
                  <div className="h-1.5 overflow-hidden rounded bg-surface-2">
                    <div className="h-full rounded bg-accent" style={{ width: `${(s.score / 4) * 100}%` }} />
                  </div>
                  <span className="text-right font-mono text-[11px] text-ink-body">{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
