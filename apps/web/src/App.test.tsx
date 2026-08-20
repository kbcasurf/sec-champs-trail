import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the not-found page for an unknown route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
    window.history.pushState({}, "", "/this-route-does-not-exist");

    render(<App />);

    await waitFor(() => expect(screen.getByText(/page not found/i)).toBeInTheDocument());
  });
});
