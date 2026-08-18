import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title and optional description", () => {
    render(<EmptyState title="Select a team" description="Pick one from the dropdown above." />);
    expect(screen.getByText("Select a team")).toBeInTheDocument();
    expect(screen.getByText("Pick one from the dropdown above.")).toBeInTheDocument();
  });

  it("renders no action link when none is provided", () => {
    render(<EmptyState title="Select a team" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders an action link when provided", () => {
    render(
      <MemoryRouter>
        <EmptyState title="Select a team" action={{ label: "View teams", to: "/teams" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "View teams" })).toHaveAttribute("href", "/teams");
  });
});
