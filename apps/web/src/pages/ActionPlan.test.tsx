import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ActionPlanPage } from "./ActionPlan";

const PLAN = {
  id: "plan-1",
  actionItems: [
    { checklistItemId: "item-1", bucket: "three_months", status: "pending", checklistItem: { title: "Nominate a captain" } },
    { checklistItemId: "item-2", bucket: "twelve_months", status: "done", checklistItem: { title: "Set up a newsletter" } },
  ],
};

function mockFetch(hasPlan: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
      }
      if (init?.method === "POST" && url.includes("/action-plans")) {
        return Promise.resolve({ ok: true, json: async () => PLAN });
      }
      if (url.includes("/action-plans/latest")) {
        return Promise.resolve({ ok: hasPlan, json: async () => PLAN });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("ActionPlan page", () => {
  it("shows a message and a generate button when there is no plan yet", async () => {
    mockFetch(false);
    render(
      <AuthProvider>
        <ActionPlanPage />
      </AuthProvider>,
    );

    expect(await screen.findByText(/no action plan yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate new plan/i })).toBeInTheDocument();
  });

  it("renders each action item under its bucket heading", async () => {
    mockFetch(true);
    render(
      <AuthProvider>
        <ActionPlanPage />
      </AuthProvider>,
    );

    expect(await screen.findByText(/nominate a captain/i)).toBeInTheDocument();
    expect(screen.getByText(/set up a newsletter/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3 months" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "12 months" })).toBeInTheDocument();
  });

  it("clicking 'generate new plan' posts and reloads", async () => {
    mockFetch(false);
    render(
      <AuthProvider>
        <ActionPlanPage />
      </AuthProvider>,
    );

    await screen.findByText(/no action plan yet/i);

    const latestCallsBefore = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).includes("/action-plans/latest"),
    ).length;

    fireEvent.click(screen.getByRole("button", { name: /generate new plan/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/teams/team-1/action-plans"), expect.objectContaining({ method: "POST" }));
    });

    await waitFor(() => {
      const latestCallsAfter = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
        String(url).includes("/action-plans/latest"),
      ).length;
      expect(latestCallsAfter).toBeGreaterThan(latestCallsBefore);
    });
  });

  it("shows error when plan generation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
        }
        if (init?.method === "POST" && url.includes("/action-plans")) {
          return Promise.resolve({ ok: false, json: async () => null });
        }
        if (url.includes("/action-plans/latest")) {
          return Promise.resolve({ ok: false, json: async () => null });
        }
        return Promise.resolve({ ok: false, json: async () => null });
      }),
    );

    render(
      <AuthProvider>
        <ActionPlanPage />
      </AuthProvider>,
    );

    await screen.findByText(/no action plan yet/i);
    fireEvent.click(screen.getByRole("button", { name: /generate new plan/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/failed to generate action plan/i);
    });
  });
});
