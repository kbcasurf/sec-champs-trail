import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { ExecutiveReportPage } from "./ExecutiveReport";

const REPORT = { id: "report-1", content: "# Executive summary\n...", createdAt: "2026-08-19T00:00:00.000Z" };

function mockFetch({ aiEnabled, reports }: { aiEnabled: boolean; reports: typeof REPORT[] }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "1", email: "a@example.com", role: "admin", teamId: null }) });
      }
      if (url.includes("/ai/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ enabled: aiEnabled }) });
      }
      if (init?.method === "POST" && url.includes("/executive-reports")) {
        return Promise.resolve({ ok: true, json: async () => REPORT });
      }
      if (url.includes("/executive-reports")) {
        return Promise.resolve({ ok: true, json: async () => reports });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

describe("ExecutiveReport page", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows the disabled banner when AI is not configured", async () => {
    mockFetch({ aiEnabled: false, reports: [] });
    render(
      <BrowserRouter>
        <AuthProvider>
          <ExecutiveReportPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByText(/ai features are not configured/i)).toBeInTheDocument();
  });

  it("shows history when AI is configured", async () => {
    mockFetch({ aiEnabled: true, reports: [REPORT] });
    render(
      <BrowserRouter>
        <AuthProvider>
          <ExecutiveReportPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByText(/executive summary/i)).toBeInTheDocument();
  });

  it("shows the consent modal before the first generation", async () => {
    mockFetch({ aiEnabled: true, reports: [] });
    render(
      <BrowserRouter>
        <AuthProvider>
          <ExecutiveReportPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /generate/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/executive-reports"), expect.objectContaining({ method: "POST" }));
    });
  });
});
