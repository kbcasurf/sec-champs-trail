import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export interface CurrentUser {
  id: string;
  email: string;
  role: "admin" | "champion";
  teamId: string | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  setUser: (user: CurrentUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ user, loading, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
