import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiConsentModal } from "./AiConsentModal";

describe("AiConsentModal", () => {
  it("renders nothing when closed", () => {
    render(<AiConsentModal open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps confirm disabled until the checkbox is checked", () => {
    render(<AiConsentModal open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const confirmButton = screen.getByRole("button", { name: /continue/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmButton).not.toBeDisabled();
  });

  it("calls onConfirm when confirmed after checking the box", () => {
    const onConfirm = vi.fn();
    render(<AiConsentModal open={true} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when cancelled", () => {
    const onCancel = vi.fn();
    render(<AiConsentModal open={true} onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});
