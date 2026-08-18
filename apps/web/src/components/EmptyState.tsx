import { Link } from "react-router-dom";

interface EmptyStateAction {
  label: string;
  to: string;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-8 py-14 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted opacity-50">
        <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" />
      </svg>
      <p className="font-mono text-sm text-ink-muted">{title}</p>
      {description && <p className="font-body text-xs text-ink-muted-2">{description}</p>}
      {action && (
        <Link
          to={action.to}
          className="mt-1 rounded-lg border border-line px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-ink-body hover:border-ink-muted-2 hover:text-ink"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
