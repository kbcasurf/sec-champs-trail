import { useState } from "react";

interface AiConsentModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AiConsentModal({ open, onConfirm, onCancel }: AiConsentModalProps) {
  const [checked, setChecked] = useState(false);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Before we continue</h2>
        <p className="mb-4 font-body text-[13px] text-ink-body">
          Generating this content sends data from this instance to the AI provider configured by your administrator.
          Review your organization&apos;s data-sharing policy before continuing.
        </p>
        <label className="mb-5 flex items-start gap-2 font-body text-[12.5px] text-ink-body">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
          I understand this data leaves this instance.
        </label>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-ink-muted hover:border-ink-muted-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!checked}
            className="rounded-lg bg-accent px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
