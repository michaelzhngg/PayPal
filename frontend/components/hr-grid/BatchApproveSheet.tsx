"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { formatMoney, type BatchApproveResult } from "@/lib/api/reclaim-pay-types";
import {
  SKIP_REASON_LABEL,
  approveButtonLabel,
  batchResultMessage,
  exclusionReason,
  exclusionSummary,
  formatTotal,
  type TriageRow,
} from "./rows";

interface BatchApproveSheetProps {
  open: boolean;
  /** Rows HR ticked. */
  selected: TriageRow[];
  /** Every row in the Quick tab, so the sheet can list what is held back and why. */
  tabRows: TriageRow[];
  selfId: string | null;
  submitting: boolean;
  error: string | null;
  /** Set after the backend answers with skipped claims, so HR sees exactly which ones. */
  result: BatchApproveResult | null;
  refFor: (reimId: string) => string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmation before a batch approval. A bottom sheet on phones, a centered
 * dialog from sm up. Native <dialog> gives Escape, focus containment and an inert page.
 */
export default function BatchApproveSheet({
  open,
  selected,
  tabRows,
  selfId,
  submitting,
  error,
  result,
  refFor,
  onConfirm,
  onClose,
}: BatchApproveSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const excluded = tabRows
    .map((row) => ({ row, reason: exclusionReason(row, selfId) }))
    .filter((x): x is { row: TriageRow; reason: NonNullable<typeof x.reason> } => x.reason !== null);
  const summary = exclusionSummary(tabRows, selfId);

  return (
    <dialog
      ref={ref}
      aria-labelledby="batch-approve-title"
      onCancel={(e) => {
        // Escape is ignored while the request is in flight so the result isn't lost.
        if (submitting) e.preventDefault();
        else onClose();
      }}
      className="m-0 mt-auto w-full max-w-none max-h-[85dvh] rounded-t-2xl p-0 bg-surface-container-lowest text-on-surface shadow-[0_-12px_48px_rgba(44,47,49,0.18)] backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-2xl sm:shadow-[0_24px_64px_rgba(44,47,49,0.22)]"
    >
      <div className="flex flex-col max-h-[85dvh]">
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-outline-variant/20">
          <div>
            <h2 id="batch-approve-title" className="font-headline font-bold text-lg">
              {result ? "Batch approval finished" : approveButtonLabel(selected)}
            </h2>
            {!result && (
              <p className="text-sm text-on-surface-variant mt-1">
                Each claim is approved and its PayPal payout starts right away.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {result ? (
            <>
              <p className="font-semibold">{batchResultMessage(result)}</p>
              {result.skipped.length > 0 && (
                <>
                  <p className="text-on-surface-variant mt-3">
                    These changed since the page loaded, so they were left for you to open one by one:
                  </p>
                  <ul className="mt-2 divide-y divide-outline-variant/20">
                    {result.skipped.map((s) => (
                      <li key={s.reim_id} className="flex items-center justify-between gap-3 py-2">
                        <span className="font-mono text-xs">{refFor(s.reim_id)}</span>
                        <span className="text-on-surface-variant">{SKIP_REASON_LABEL[s.reason]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <>
              <ul className="divide-y divide-outline-variant/20" aria-label="Claims to approve">
                {selected.map((row) => (
                  <li key={row.reimId} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.employee}</span>
                      <span className="block font-mono text-xs text-on-surface-variant">{row.ref}</span>
                    </span>
                    <span className="tabular-nums font-semibold shrink-0">{formatMoney(row.currency, row.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-outline-variant/40 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatTotal(selected)}</span>
              </p>

              {summary && (
                <section className="mt-5 rounded-lg bg-surface-container-low px-4 py-3" aria-labelledby="batch-excluded">
                  <h3 id="batch-excluded" className="font-semibold">
                    {summary}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5 text-on-surface-variant">
                    {excluded.map(({ row, reason }) => (
                      <li key={row.reimId} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-xs">{row.ref}</span> · {row.employee}
                        </span>
                        <span className="shrink-0">{SKIP_REASON_LABEL[reason]}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {error && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 px-5 py-4 border-t border-outline-variant/20 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-4">
          {result ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-dim focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[44px] px-5 rounded-lg border border-outline-variant/50 font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer"
              >
                Keep reviewing
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting || selected.length === 0}
                autoFocus
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-dim disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {submitting ? "Approving…" : `Approve and pay ${selected.length}`}
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}
