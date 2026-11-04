"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable: the value is still visible to copy by hand.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <span className="min-w-0">
        <span className="block text-xs text-ink-muted">{label}</span>
        <span className="block truncate font-mono text-sm text-ink">{value}</span>
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
