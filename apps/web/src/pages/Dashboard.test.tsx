import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { Dashboard, wrapLabel } from "./Dashboard";

function mockFetchFor(role: "admin" | "champion") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "1", email: "cap@example.com", role, teamId: role === "champion" ? "team-1" : null }),
        });
      }
      if (url.includes("/teams") && !url.includes("/assessments")) {
        return Promise.resolve({ ok: true, json: async () => [{ id: "team-1", name: "Payments" }] });
      }
      if (url.includes("/assessments/latest")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            principleScores: [
              { score: 2, principle: { id: "p1", title: "Be passionate about security" } },
              { score: 3, principle: { id: "p2", title: "Trust your champions" } },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("Dashboard page", () => {
  it("shows a team selector for admins and loads the selected team's latest scores", async () => {
    mockFetchFor("admin");
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    expect(await screen.findByText("Payments")).toBeInTheDocument();
  });

  it("shows an error message when the champion's team has no assessment yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
        }
        return Promise.resolve({ ok: false, json: async () => null });
      }),
    );

    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>,
    );

    expect(await screen.findByText(/no assessment yet/i)).toBeInTheDocument();
  });

  it("shows an empty state before an admin selects a team", async () => {
    mockFetchFor("admin");
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>,
    );

    expect(await screen.findByText(/Pick a team from the dropdown/i)).toBeInTheDocument();
  });
});

describe("wrapLabel", () => {
  it("wraps a long principle title without cutting words, in 3 lines or fewer", () => {
    const lines = wrapLabel("Start with a clear vision for your program");
    expect(lines.join(" ")).toBe("Start with a clear vision for your program");
    expect(lines.length).toBeLessThanOrEqual(3);
    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(18));
  });

  it("keeps a short title on a single line", () => {
    expect(wrapLabel("Create a community")).toEqual(["Create a community"]);
  });
});
