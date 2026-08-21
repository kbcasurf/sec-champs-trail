import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings as heading elements, not literal '#' text", () => {
    render(<Markdown text={"## Overview\n\nSome text."} />);
    expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();
  });

  it("renders bold text inside a strong element", () => {
    render(<Markdown text="This is **important** context." />);
    expect(screen.getByText("important").tagName).toBe("STRONG");
  });

  it("renders an unordered list as list items", () => {
    render(<Markdown text={"- First item\n- Second item"} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("First item")).toBeInTheDocument();
  });

  it("renders an ordered list (e.g. a reinforcement quiz) as list items", () => {
    render(<Markdown text={"1. What is XSS?\n2. What is CSRF?"} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("What is XSS?")).toBeInTheDocument();
  });

  it("does not interpret raw HTML in the input as markup", () => {
    render(<Markdown text={"<img src=x onerror=alert(1)>"} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/<img/)).toBeInTheDocument();
  });
});
