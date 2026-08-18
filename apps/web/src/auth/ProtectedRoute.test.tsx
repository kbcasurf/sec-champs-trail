import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

function renderProtected(initialUser: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/auth/logout")) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({ ok: initialUser !== null, json: async () => initialUser });
    }),
  );

  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<p>dashboard content</p>} />
            <Route path="/checklist" element={<p>checklist content</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    renderProtected(null);
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
  });

  it("renders the nav and the route content when a user is authenticated", async () => {
    renderProtected({ id: "1", email: "captain@example.com", role: "admin", teamId: null });
    await waitFor(() => expect(screen.getByText("dashboard content")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /teams/i })).toBeInTheDocument();
  });

  it("logging out redirects back to /login", async () => {
    renderProtected({ id: "1", email: "captain@example.com", role: "admin", teamId: null });
    await waitFor(() => expect(screen.getByText("dashboard content")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
  });

  it("toggles the mobile menu open state when the hamburger button is clicked", async () => {
    renderProtected({ id: "1", email: "captain@example.com", role: "admin", teamId: null });
    await waitFor(() => expect(screen.getByText("dashboard content")).toBeInTheDocument());

    const toggle = screen.getByRole("button", { name: /open menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /close menu/i })).toBe(toggle);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /open menu/i })).toBe(toggle);
  });

  it("closes the mobile menu when a nav link is clicked", async () => {
    renderProtected({ id: "1", email: "captain@example.com", role: "admin", teamId: null });
    await waitFor(() => expect(screen.getByText("dashboard content")).toBeInTheDocument());

    const toggle = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("link", { name: /checklist/i }));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /open menu/i })).toBe(toggle);
  });
});
