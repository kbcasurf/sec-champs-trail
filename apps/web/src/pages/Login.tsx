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
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">ChampionForge</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Log in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
