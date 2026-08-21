import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { TrainingTrackPage } from "./TrainingTrack";

const TRACK = {
  id: "track-1",
  techStack: "Node.js",
  experienceLevel: "intermediate",
  hoursPerWeek: 4,
  createdAt: "2026-08-19T00:00:00.000Z",
  modules: [{ order: 0, title: "Intro to OWASP Top 10", content: "## Overview\n..." }],
};

function mockFetch({ aiEnabled, tracks }: { aiEnabled: boolean; tracks: typeof TRACK[] }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
      }
      if (url.includes("/ai/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ enabled: aiEnabled }) });
      }
      if (init?.method === "POST" && url.includes("/training-tracks")) {
        return Promise.resolve({ ok: true, json: async () => TRACK });
      }
      if (url.includes("/training-tracks")) {
        return Promise.resolve({ ok: true, json: async () => tracks });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("TrainingTrack page", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows the disabled banner when AI is not configured", async () => {
    mockFetch({ aiEnabled: false, tracks: [] });
    render(
      <BrowserRouter>
        <AuthProvider>
          <TrainingTrackPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByText(/ai features are not configured/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate/i })).not.toBeInTheDocument();
  });

  it("shows the generation form and history when AI is configured", async () => {
    mockFetch({ aiEnabled: true, tracks: [TRACK] });
    render(
      <BrowserRouter>
        <AuthProvider>
          <TrainingTrackPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByRole("button", { name: /generate/i })).toBeInTheDocument();
    expect(await screen.findByText(/intro to owasp top 10/i)).toBeInTheDocument();
  });

  it("shows the consent modal before the first generation, then submits after confirming", async () => {
    mockFetch({ aiEnabled: true, tracks: [] });
    render(
      <BrowserRouter>
        <AuthProvider>
          <TrainingTrackPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/tech stack/i), { target: { value: "Node.js" } });
    fireEvent.change(screen.getByLabelText(/hours per week/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/teams/team-1/training-tracks"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows generating state on button while AI generation is in flight", async () => {
    let resolveGenerate: () => void;
    const generatePromise = new Promise<{ ok: boolean; json: () => Promise<typeof TRACK> }>((resolve) => {
      resolveGenerate = () => resolve({ ok: true, json: async () => TRACK });
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "c@example.com", role: "champion", teamId: "team-1" }) });
        }
        if (url.includes("/ai/status")) {
          return Promise.resolve({ ok: true, json: async () => ({ enabled: true }) });
        }
        if (init?.method === "POST" && url.includes("/training-tracks")) {
          return generatePromise;
        }
        if (url.includes("/training-tracks")) {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: false, json: async () => null });
      }),
    );

    render(
      <BrowserRouter>
        <AuthProvider>
          <TrainingTrackPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    fireEvent.change(await screen.findByLabelText(/tech stack/i), { target: { value: "Node.js" } });
    fireEvent.change(screen.getByLabelText(/hours per week/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /generate track/i }));

    // Dismiss consent modal and confirm generation
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // While fetch is unresolved, button should show "Generating…"
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /generating/i })).toBeInTheDocument();
    });

    // After resolving, button should return to "Generate track"
    resolveGenerate!();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /generate track/i })).toBeInTheDocument();
    });
  });
});
