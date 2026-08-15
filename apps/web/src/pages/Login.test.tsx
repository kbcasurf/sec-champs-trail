import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { Login } from "./Login";

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Login page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth/me")) return Promise.resolve({ ok: false, json: async () => null });
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "1", email: "captain@example.com", role: "admin", teamId: null }),
        });
      }),
    );
  });

  it("submits email and password to the login endpoint", async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "captain@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/login"),
        expect.objectContaining({ method: "POST", credentials: "include" }),
      );
    });
  });

  it("shows an error message when login fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/auth/me")) return Promise.resolve({ ok: false, json: async () => null });
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
