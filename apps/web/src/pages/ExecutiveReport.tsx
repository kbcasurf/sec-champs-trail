import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AiConsentModal } from "../components/AiConsentModal";
import { AiDisabledBanner } from "../components/AiDisabledBanner";
import { Markdown } from "../components/Markdown";
import { hasAiConsent, grantAiConsent } from "../lib/aiConsent";
import { downloadMarkdown } from "../lib/downloadMarkdown";

interface ExecutiveReportView {
  id: string;
  content: string;
  createdAt: string;
}

export function ExecutiveReportPage() {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ExecutiveReportView[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    apiFetch("/ai/status").then(async (res) => {
      if (res.ok) setAiEnabled((await res.json()).enabled);
    });
  }, []);

  useEffect(() => {
    apiFetch("/executive-reports").then(async (res) => {
      if (res.ok) setReports(await res.json());
    });
  }, []);

  async function doGenerate() {
    setGenerating(true);
    setError(null);
    const res = await apiFetch("/executive-reports", { method: "POST" });
    if (res.ok) {
      const report = await res.json();
      setReports((prev) => [report, ...prev]);
    } else {
      setError("Failed to generate the executive report. Please try again.");
    }
    setGenerating(false);
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
        <h1 className="mb-7 font-display text-2xl font-bold text-ink">Executive report</h1>
        <AiDisabledBanner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-16 pt-10">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Executive report</h1>
        <button
          onClick={handleGenerateClick}
          disabled={generating}
          className="rounded-lg bg-accent px-4.5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {generating ? "Generating…" : "Generate report"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 font-body text-[12.5px] text-danger">
          {error}
        </p>
      )}

      <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Conteúdo gerado por IA</div>

      {reports.map((report) => (
        <div key={report.id} className="mb-6 rounded-2xl border border-line bg-surface p-5">
          <p className="mb-3 font-mono text-[11px] text-ink-muted">{new Date(report.createdAt).toLocaleString()}</p>
          <div className="mb-3 flex gap-3">
            <button
              onClick={() => downloadMarkdown(`executive-report-${report.id}.md`, `*Conteúdo gerado por IA*\n\n${report.content}`)}
              className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-ink-muted hover:border-ink-muted-2 hover:text-ink"
            >
              Export Markdown
            </button>
            <Link
              to={`/executive-reports/${report.id}/print`}
              target="_blank"
              className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-ink-muted hover:border-ink-muted-2 hover:text-ink"
            >
              Export PDF
            </Link>
          </div>
          <Markdown text={report.content} />
        </div>
      ))}

      <AiConsentModal open={consentOpen} onConfirm={handleConsentConfirm} onCancel={() => setConsentOpen(false)} />
    </div>
  );
}
