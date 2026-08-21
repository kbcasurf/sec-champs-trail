import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">404</p>
      <h1 className="font-display text-xl font-bold text-ink">Page not found</h1>
      <p className="max-w-sm font-body text-[13px] text-ink-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-2 rounded-lg bg-accent px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
