import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function mockFetchForChampion() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "1", email: "champ@example.com", role: "champion", teamId: "team-1" }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    }),
  );
}

afterEach(async () => {
  // AuthContext resolves /auth/me asynchronously, and pages like TrainingTrackPage
  // fire their own effects only once that resolution updates `user`/`teamId`. A
  // rendered test can finish (its `waitFor` condition is already true on first
  // paint) before those effects run, so unstubbing `fetch` immediately can race
  // ahead of them — the real `fetch` then rejects on the app's relative URLs
  // (they're only valid resolved against `window.location`, which only a browser
  // provides), a failure vitest reports as an "unhandled rejection" attributed to
  // whichever test happened to be running. Flushing one macrotask first lets any
  // already-scheduled effect run against the still-active mock before teardown.
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("renders the not-found page for an unknown route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
    window.history.pushState({}, "", "/this-route-does-not-exist");

    render(<App />);

    await waitFor(() => expect(screen.getByText(/page not found/i)).toBeInTheDocument());
  });

  it("redirects a champion away from /teams instead of rendering the admin page", async () => {
    mockFetchForChampion();
    window.history.pushState({}, "", "/teams");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Teams" })).not.toBeInTheDocument();
  });

  it("redirects a champion away from /executive-reports instead of rendering the admin page", async () => {
    mockFetchForChampion();
    window.history.pushState({}, "", "/executive-reports");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument());
  });

  it("lets a champion reach /training-tracks (not nested inside AdminRoute)", async () => {
    mockFetchForChampion();
    window.history.pushState({}, "", "/training-tracks");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Training track" })).toBeInTheDocument());
  });
});
