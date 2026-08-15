import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { AssessmentForm } from "./AssessmentForm";

const PRINCIPLES = [
  {
    id: "be-passionate-about-security",
    title: "Be passionate about security",
    maturityLevels: [
      { level: 0, description: "No one is recruited for passion." },
      { level: 1, description: "A few individuals show interest." },
      { level: 2, description: "Passionate volunteers are sought." },
      { level: 3, description: "Passionate champions are consistently recruited." },
      { level: 4, description: "Passion is part of the company's DNA." },
    ],
  },
];

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
      if (url.includes("/assessments") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "assessment-1" }) });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("AssessmentForm page", () => {
  it("submits one score per principle to the team's assessments endpoint", async () => {
    mockFetch();
    render(
      <MemoryRouter>
        <AuthProvider>
          <AssessmentForm />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Be passionate about security")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/3 — Passionate champions are consistently recruited/));
    fireEvent.click(screen.getByRole("button", { name: /submit assessment/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/teams/team-1/assessments"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ scores: [{ principleId: "be-passionate-about-security", score: 3 }] }),
        }),
      );
    });
  });
});
