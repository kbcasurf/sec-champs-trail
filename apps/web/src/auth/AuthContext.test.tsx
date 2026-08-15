import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{user ? `logged in as ${user.email}` : "logged out"}</p>;
}

describe("AuthContext", () => {
  it("loads the current user from GET /auth/me on mount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1", email: "captain@example.com", role: "admin", teamId: null }),
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("logged in as captain@example.com")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/me"), expect.objectContaining({ credentials: "include" }));
  });

  it("treats a 401 from /auth/me as logged out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("logged out")).toBeInTheDocument());
  });
});
