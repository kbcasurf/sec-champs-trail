import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

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
  modules: TrainingModuleView[];
}

export function TrainingTrackPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [track, setTrack] = useState<TrainingTrackView | null>(null);

  useEffect(() => {
    if (!user?.teamId || !id) return;
    apiFetch(`/teams/${user.teamId}/training-tracks/${id}`).then(async (res) => {
      if (res.ok) setTrack(await res.json());
    });
  }, [user, id]);

  useEffect(() => {
    if (track) window.print();
  }, [track]);

  if (!track) return null;

  return (
    <div className="mx-auto max-w-[900px] p-10">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Training track — {track.techStack}</h1>
      <p className="mb-6 font-mono text-xs uppercase tracking-wide text-ink-muted">Conteúdo gerado por IA</p>
      {track.modules.map((module) => (
        <div key={module.order} className="mb-6">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">{module.title}</h2>
          <pre className="whitespace-pre-wrap font-body text-sm text-ink-body">{module.content}</pre>
        </div>
      ))}
    </div>
  );
}
