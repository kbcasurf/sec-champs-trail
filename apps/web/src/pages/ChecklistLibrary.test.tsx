import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ChecklistLibrary } from "./ChecklistLibrary";

const PRINCIPLES = [{ id: "be-passionate-about-security", title: "Be passionate about security" }];
const CHECKLIST_ITEM = {
  id: "item-1",
  principleId: "be-passionate-about-security",
  phase: "recruitment",
  title: "Highlight your security culture when hiring",
  status: "pending",
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
      }
      if (url.includes("/principles")) {
        return Promise.resolve({ ok: true, json: async () => PRINCIPLES });
      }
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: async () => ({ status: "done" }) });
      }
      if (url.includes("/checklist-progress")) {
        return Promise.resolve({ ok: true, json: async () => [CHECKLIST_ITEM] });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("ChecklistLibrary page", () => {
  it("groups items under their phase and principle, and toggles progress on click", async () => {
    mockFetch();
    render(
      <AuthProvider>
        <ChecklistLibrary />
      </AuthProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Recruitment" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Be passionate about security" })).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", { name: /highlight your security culture when hiring/i });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/teams/team-1/checklist-progress/item-1"),
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "done" }) }),
      );
    });
    expect(checkbox).toBeChecked();
  });

  it("shows error message when toggle fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
        }
        if (url.includes("/principles")) {
          return Promise.resolve({ ok: true, json: async () => PRINCIPLES });
        }
        if (init?.method === "PATCH") {
          return Promise.resolve({ ok: false, json: async () => ({ error: "not found" }) });
        }
        if (url.includes("/checklist-progress")) {
          return Promise.resolve({ ok: true, json: async () => [CHECKLIST_ITEM] });
        }
        return Promise.resolve({ ok: false, json: async () => null });
      }),
    );
    render(
      <AuthProvider>
        <ChecklistLibrary />
      </AuthProvider>,
    );

    const checkbox = await screen.findByRole("checkbox", { name: /highlight your security culture when hiring/i });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    const errorMessage = await screen.findByRole("alert");
    expect(errorMessage).toHaveTextContent("Could not update progress.");
    expect(checkbox).not.toBeChecked();
  });

  it("shows a team selector for admins and loads the selected team's checklist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "admin@example.com", role: "admin", teamId: null }) });
        }
        if (url.includes("/principles")) {
          return Promise.resolve({ ok: true, json: async () => PRINCIPLES });
        }
        if (url.includes("/checklist-progress")) {
          return Promise.resolve({ ok: true, json: async () => [CHECKLIST_ITEM] });
        }
        if (url.includes("/teams")) {
          return Promise.resolve({ ok: true, json: async () => [{ id: "team-1", name: "Payments" }] });
        }
        return Promise.resolve({ ok: false, json: async () => null });
      }),
    );

    render(
      <AuthProvider>
        <ChecklistLibrary />
      </AuthProvider>,
    );

    const select = await screen.findByRole("combobox");
    expect(await screen.findByText("Payments")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recruitment" })).not.toBeInTheDocument();
    expect(screen.getByText(/pick a team from the dropdown/i)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "team-1" } });

    expect(await screen.findByRole("heading", { name: "Recruitment" })).toBeInTheDocument();
  });
});
