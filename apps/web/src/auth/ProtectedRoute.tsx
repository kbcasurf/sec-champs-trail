import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { apiFetch } from "../lib/api";

const NAV_ICONS: Record<string, JSX.Element> = {
  "/dashboard": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  "/assessment/new": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1Z" />
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <path d="M8.5 12.5l2 2 4-4.5" />
    </svg>
  ),
  "/checklist": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M7 9h4M7 13h10M7 17h10" />
    </svg>
  ),
  "/action-plan": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V6a1 1 0 0 1 1-1h8l6 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M13 5v5a1 1 0 0 0 1 1h5" />
      <path d="M8 15h6M8 12h3" />
    </svg>
  ),
  "/teams": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.6" />
      <path d="M19 20a6.5 6.5 0 0 0-3.2-5.6" />
    </svg>
  ),
};

const NAV_LINKS: { to: string; label: string; adminOnly?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/assessment/new", label: "New assessment" },
  { to: "/checklist", label: "Checklist" },
  { to: "/action-plan", label: "Action plan" },
  { to: "/teams", label: "Teams", adminOnly: true },
];

export function ProtectedRoute() {
  const { user, loading, setUser } = useAuth();
  const location = useLocation();

  if (loading) return <p className="p-6 font-mono text-sm text-ink-muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line bg-bg-elevated px-4 py-3 sm:px-7">
        <div className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" stroke="#f97316" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="1.6" fill="#f97316" />
          </svg>
          <span className="font-display text-[17px] font-bold tracking-tight text-ink">
            Champion<span className="text-accent">Forge</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {NAV_LINKS.filter((l) => !l.adminOnly || user.role === "admin").map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs font-medium uppercase tracking-wide ${
                  active
                    ? "border-accent-border bg-accent-soft text-accent"
                    : "border-transparent text-ink-muted hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {NAV_ICONS[l.to]}
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3.5">
          <span className="rounded border border-accent-border bg-accent-soft px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            {user.role}
          </span>
          <span className="font-mono text-xs text-ink-body">{user.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 font-mono text-xs text-ink-muted hover:border-ink-muted-2 hover:bg-surface-hover hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Log out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
