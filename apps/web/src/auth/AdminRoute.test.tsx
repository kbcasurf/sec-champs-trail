import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";

function renderAdminRoute(role: "admin" | "champion") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "1",
        email: "user@example.com",
        role,
        teamId: role === "champion" ? "team-1" : null,
      }),
    }),
  );

  return render(
    <MemoryRouter initialEntries={["/teams"]}>
      <AuthProvider>
        <Routes>
          <Route path="/dashboard" element={<p>dashboard content</p>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminRoute />}>
              <Route path="/teams" element={<p>teams admin content</p>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("AdminRoute", () => {
  it("renders the route content for an admin", async () => {
    renderAdminRoute("admin");
    await waitFor(() => expect(screen.getByText("teams admin content")).toBeInTheDocument());
  });

  it("redirects a champion to /dashboard instead of rendering the admin content", async () => {
    renderAdminRoute("champion");
    await waitFor(() => expect(screen.getByText("dashboard content")).toBeInTheDocument());
    expect(screen.queryByText("teams admin content")).not.toBeInTheDocument();
  });
});
