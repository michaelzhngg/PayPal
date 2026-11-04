"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import type { ConfigChange } from "../_lib/autonomy";

/** Bottom sheet on phones, centered dialog from sm up. Native <dialog> gives Escape and focus containment. */
function Sheet({
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

function ReasonField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        Reason <span className="text-on-surface-variant font-normal">(required)</span>
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-sm placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary"
      />
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-error font-medium">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

// ─── Save ────────────────────────────────────────────────────────────────────

export function SaveDialog({
  open,
  nextVersion,
  changes,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  nextVersion: number;
  changes: ConfigChange[];
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  // The parent remounts this dialog (via `key`) each time it opens, so the fields start empty.
  const [reason, setReason] = useState("");

  return (
    <Sheet open={open} titleId="save-title" title={`Save version ${nextVersion}?`} busy={busy} onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 text-sm">
        <p className="text-on-surface-variant">New claims use these limits as soon as you save. Claims already decided stay as they are.</p>
        <table className="w-full">
          <caption className="sr-only">Changes</caption>
          <thead>
            <tr className="text-left text-xs text-on-surface-variant">
              <th scope="col" className="pb-1 font-medium">Setting</th>
              <th scope="col" className="pb-1 font-medium text-right">Before</th>
              <th scope="col" className="pb-1 font-medium text-right">After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {changes.map((c) => (
              <tr key={c.key}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">{c.label}</th>
                <td className="py-2 pl-2 text-right tabular-nums text-on-surface-variant whitespace-nowrap">
                  <s>{c.before}</s>
                </td>
                <td className="py-2 pl-2 text-right tabular-nums font-semibold whitespace-nowrap">{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ReasonField id="save-reason" value={reason} onChange={setReason} placeholder="For example: raising limits after the Q3 audit" />
        <ErrorLine error={error} />
      </div>
      <footer className="flex flex-col-reverse gap-2 px-5 py-4 border-t border-outline-variant/20 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={busy} className={`${btnBase} text-on-surface hover:bg-surface-container focus-visible:outline-primary`}>
          Keep editing
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason.trim())}
          disabled={busy || !reason.trim()}
          className={`${btnBase} bg-primary text-on-primary hover:bg-primary-dim focus-visible:outline-primary`}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Save version {nextVersion}
        </button>
      </footer>
    </Sheet>
  );
}

// ─── Kill switch ─────────────────────────────────────────────────────────────

export const PAUSE_WORD = "PAUSE";

export function KillSwitchDialog({
  open,
  pausing,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /** True when the switch is about to pause auto-pay, false when it resumes. */
  pausing: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");

  const typedOk = !pausing || typed.trim().toUpperCase() === PAUSE_WORD;
  const canConfirm = !busy && !!reason.trim() && typedOk;

  return (
    <Sheet
      open={open}
      titleId="kill-title"
      title={pausing ? "Pause all automatic payouts?" : "Turn automatic payouts back on?"}
      busy={busy}
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 text-sm">
        <p className="text-on-surface-variant">
          {pausing
            ? "New claims will wait for HR until you turn this back on. Payouts already sent to PayPal are not affected."
            : "Claims that pass every check will be paid to PayPal right away again, within the limits on this page."}
        </p>
        <ReasonField
          id="kill-reason"
          value={reason}
          onChange={setReason}
          placeholder={pausing ? "For example: pausing during month-end close" : "For example: month-end close is done"}
        />
        {pausing && (
          <div>
            <label htmlFor="kill-typed" className="block text-sm font-medium">
              Type <span className="font-mono font-bold">{PAUSE_WORD}</span> to confirm
            </label>
            <input
              id="kill-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 w-full min-h-[44px] rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 text-sm font-mono uppercase focus-visible:outline-2 focus-visible:outline-primary"
            />
          </div>
        )}
        <ErrorLine error={error} />
      </div>
      <footer className="flex flex-col-reverse gap-2 px-5 py-4 border-t border-outline-variant/20 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={busy} className={`${btnBase} text-on-surface hover:bg-surface-container focus-visible:outline-primary`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason.trim())}
          disabled={!canConfirm}
          className={`${btnBase} ${
            pausing ? "bg-error text-on-error hover:bg-error-dim focus-visible:outline-error" : "bg-primary text-on-primary hover:bg-primary-dim focus-visible:outline-primary"
          }`}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {pausing ? "Pause auto-pay" : "Resume auto-pay"}
        </button>
      </footer>
    </Sheet>
  );
}
