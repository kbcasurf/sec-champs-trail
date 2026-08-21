import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { AiConsentModal } from "../components/AiConsentModal";
import { AiDisabledBanner } from "../components/AiDisabledBanner";
import { Markdown } from "../components/Markdown";
import { hasAiConsent, grantAiConsent } from "../lib/aiConsent";
import { downloadMarkdown } from "../lib/downloadMarkdown";

interface TrainingModuleView {
  order: number;
  title: string;
  content: string;
}

interface TrainingTrackView {
  id: string;
  techStack: string;
  experienceLevel: string;
  hoursPerWeek: number;
  createdAt: string;
  modules: TrainingModuleView[];
}

export function TrainingTrackPage() {
  const { user } = useAuth();
  const teamId = user?.teamId ?? null;

  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [tracks, setTracks] = useState<TrainingTrackView[]>([]);
  const [techStack, setTechStack] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [hoursPerWeek, setHoursPerWeek] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    apiFetch("/ai/status").then(async (res) => {
      if (res.ok) setAiEnabled((await res.json()).enabled);
    });
  }, []);

  useEffect(() => {
    if (!teamId) return;
    apiFetch(`/teams/${teamId}/training-tracks`).then(async (res) => {
      if (res.ok) setTracks(await res.json());
    });
  }, [teamId]);

  async function doGenerate() {
    if (!teamId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch(`/teams/${teamId}/training-tracks`, {
        method: "POST",
        body: JSON.stringify({ techStack, experienceLevel, hoursPerWeek }),
      });
      if (res.ok) {
        const track = await res.json();
        setTracks((prev) => [track, ...prev]);
      } else {
        setError("Failed to generate a training track. Please try again.");
      }
    } catch {
      setError("Failed to generate a training track. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerateClick() {
    if (hasAiConsent()) {
      doGenerate();
    } else {
      setConsentOpen(true);
    }
  }

  function handleConsentConfirm() {
    grantAiConsent();
    setConsentOpen(false);
    doGenerate();
  }

  if (aiEnabled === false) {
    return (
      <div className="mx-auto max-w-[1280px] px-8 pb-16 pt-10">
        <h1 className="mb-7 font-display text-2xl font-bold text-ink">Training track</h1>
        <AiDisabledBanner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-16 pt-10">
      <h1 className="mb-7 font-display text-2xl font-bold text-ink">Training track</h1>

      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-2xl border border-line bg-surface p-5">
        <label className="flex flex-col gap-1 font-body text-xs text-ink-muted">
          Tech stack
          <input
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            className="rounded-lg border border-line bg-bg px-3 py-2 font-body text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-muted">
          Experience level
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="rounded-lg border border-line bg-bg px-3 py-2 font-body text-sm text-ink"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-ink-muted">
          Hours per week
          <input
            type="number"
            min={1}
            max={40}
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(Number(e.target.value))}
            className="w-24 rounded-lg border border-line bg-bg px-3 py-2 font-body text-sm text-ink"
          />
        </label>
        <button
          onClick={handleGenerateClick}
          disabled={generating || !teamId || !techStack}
          className="rounded-lg bg-accent px-4.5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {generating ? "Generating…" : "Generate track"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 font-body text-[12.5px] text-danger">
          {error}
        </p>
      )}

      <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Conteúdo gerado por IA</div>

      {tracks.map((track) => (
        <div key={track.id} className="mb-6 rounded-2xl border border-line bg-surface p-5">
          <p className="mb-3 font-mono text-[11px] text-ink-muted">
            {track.techStack} — {track.experienceLevel} — {track.hoursPerWeek}h/week — {new Date(track.createdAt).toLocaleString()}
          </p>
          <div className="mb-3 flex gap-3">
            <button
              onClick={() =>
                downloadMarkdown(
                  `training-track-${track.id}.md`,
                  `# Training track — ${track.techStack}\n\n*Conteúdo gerado por IA*\n\n` +
                    track.modules.map((m) => `## ${m.title}\n\n${m.content}`).join("\n\n"),
                )
              }
              className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-ink-muted hover:border-ink-muted-2 hover:text-ink"
            >
              Export Markdown
            </button>
            <Link
              to={`/training-tracks/${track.id}/print`}
              target="_blank"
              className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-ink-muted hover:border-ink-muted-2 hover:text-ink"
            >
              Export PDF
            </Link>
          </div>
          {track.modules.map((module) => (
            <div key={module.order} className="mb-4">
              <h3 className="mb-1 font-display text-sm font-semibold text-ink">{module.title}</h3>
              <Markdown text={module.content} />
            </div>
          ))}
        </div>
      ))}

      <AiConsentModal open={consentOpen} onConfirm={handleConsentConfirm} onCancel={() => setConsentOpen(false)} />
    </div>
  );
}
