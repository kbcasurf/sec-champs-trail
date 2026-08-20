import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

interface ExecutiveReportView {
  id: string;
  content: string;
}

export function ExecutiveReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ExecutiveReportView | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/executive-reports/${id}`).then(async (res) => {
      if (res.ok) setReport(await res.json());
    });
  }, [id]);

  useEffect(() => {
    if (report) window.print();
  }, [report]);

  if (!report) return null;

  return (
    <div className="mx-auto max-w-[900px] p-10">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Executive report</h1>
      <p className="mb-6 font-mono text-xs uppercase tracking-wide text-ink-muted">Conteúdo gerado por IA</p>
      <pre className="whitespace-pre-wrap font-body text-sm text-ink-body">{report.content}</pre>
    </div>
  );
}
