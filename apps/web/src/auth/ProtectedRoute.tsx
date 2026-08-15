import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { apiFetch } from "../lib/api";

export function ProtectedRoute() {
  const { user, loading, setUser } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <div>
      <nav className="flex gap-4 border-b p-4">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/assessment/new">New assessment</Link>
        <Link to="/checklist">Checklist</Link>
        <Link to="/action-plan">Action plan</Link>
        {user.role === "admin" && <Link to="/teams">Teams</Link>}
        <button onClick={handleLogout}>Log out</button>
      </nav>
      <Outlet />
    </div>
  );
}
