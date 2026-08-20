export function AiDisabledBanner() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-16 text-center">
      <p className="font-mono text-sm text-ink-muted">AI features are not configured</p>
      <p className="mt-2 font-body text-xs text-ink-muted-2">
        This feature requires an AI provider API key configured by this instance&apos;s administrator. Every
        other feature works normally without one.
      </p>
    </div>
  );
}
