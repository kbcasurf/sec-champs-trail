import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { TeamsAdmin } from "./TeamsAdmin";

function mockFetch() {
  const teamDetail = { id: "team-1", name: "Payments", champions: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "admin@example.com", role: "admin", teamId: null }) });
      }
      if (init?.method === "POST" && url.includes("/champions")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "c1", email: "new@example.com", role: "champion", teamId: "team-1" }) });
      }
      if (init?.method === "POST" && url.endsWith("/teams")) {
        return Promise.resolve({ ok: true, json: async () => teamDetail });
      }
      if (url === "http://localhost:3000/teams" || url.endsWith("/teams")) {
        return Promise.resolve({ ok: true, json: async () => [{ id: "team-1", name: "Payments" }] });
      }
      if (url.includes("/teams/team-1")) {
        return Promise.resolve({ ok: true, json: async () => teamDetail });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("TeamsAdmin page", () => {
  it("lists teams and selecting one shows its champion roster and add-champion form", async () => {
    mockFetch();
    render(
      <AuthProvider>
        <TeamsAdmin />
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Payments" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument());
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("submits a new champion assigned to the selected team", async () => {
    mockFetch();
    render(
      <AuthProvider>
        <TeamsAdmin />
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Payments" }));
    await screen.findByRole("heading", { name: "Payments" });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /add champion/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/champions"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "new@example.com", password: "correct-horse", role: "champion", teamId: "team-1" }),
        }),
      );
    });
  });
});
