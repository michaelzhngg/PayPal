"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, X } from "lucide-react";

export const btnBase =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

/** Bottom sheet on phones, centered dialog from sm up. Native <dialog> gives Escape and focus containment. */
export function Sheet({
  open,
  titleId,
  title,
  busy,
  onClose,
  children,
}: {
  open: boolean;
  titleId: string;
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none max-h-[90dvh] rounded-t-2xl p-0 bg-surface-container-lowest text-on-surface shadow-[0_-12px_48px_rgba(44,47,49,0.18)] backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-2xl sm:shadow-[0_24px_64px_rgba(44,47,49,0.22)]"
    >
      <div className="flex flex-col max-h-[90dvh]">
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-outline-variant/20">
          <h2 id={titleId} className="font-headline font-bold text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-error font-medium">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  );
}
