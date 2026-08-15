import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ChecklistLibrary } from "./ChecklistLibrary";

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
      }
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: async () => ({ status: "done" }) });
      }
      if (url.includes("/checklist-progress")) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "item-1", title: "Highlight your security culture when hiring", status: "pending" }],
        });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("ChecklistLibrary page", () => {
  it("lists checklist items and toggles progress on click", async () => {
    mockFetch();
    render(
      <AuthProvider>
        <ChecklistLibrary />
      </AuthProvider>,
    );

    const checkbox = await screen.findByRole("checkbox", { name: /highlight your security culture when hiring/i });
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
});
