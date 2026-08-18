import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError("Invalid credentials");
      return;
    }

    setUser(await res.json());
    navigate("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg">
      <div
        className="pointer-events-none absolute -right-40 -top-56 h-[720px] w-[720px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(249,115,22,0.16) 0%, rgba(249,115,22,0.05) 45%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      <div className="absolute left-9 top-9 h-6 w-6 border-l-2 border-t-2 border-accent opacity-85" />
      <div className="absolute bottom-9 right-9 h-6 w-6 border-b-2 border-r-2 border-accent opacity-85" />
      <p className="absolute top-10 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
        Open-source AppSec tooling <span className="font-semibold text-accent">///</span> Self-hosted
      </p>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-[380px] rounded-2xl border border-line bg-surface p-9 pt-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" stroke="#f97316" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="1.6" fill="#f97316" />
          </svg>
          <span className="font-display text-xl font-bold text-ink">
            Champion<span className="text-accent">Forge</span>
          </span>
        </div>
        <h1 className="mb-1 font-display text-[17px] font-semibold text-ink">Sign in to your program</h1>
        <p className="mb-7 font-body text-[13px] leading-relaxed text-ink-muted">
          Assess maturity, track OWASP checklists, and generate action plans for your Security Champions program.
        </p>

        <div className="mb-4">
          <label htmlFor="email" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-ink-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@organization.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 font-body text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </div>
        <div className="mb-1.5">
          <label htmlFor="password" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-ink-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg-elevated px-3 py-2.5 font-body text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </div>

        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover active:bg-accent-active"
        >
          Log in
        </button>

        {error && (
          <p
            role="alert"
            className="mt-3.5 flex items-center gap-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 font-body text-[12.5px] text-danger"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            {error}
          </p>
        )}

        <div className="mt-5 border-t border-line-soft pt-4 font-mono text-[11px] leading-relaxed text-ink-muted-2">
          There is no public sign-up — admins are created via bootstrap.
        </div>
      </form>
    </div>
  );
}
