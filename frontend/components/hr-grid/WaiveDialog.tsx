"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { waiveRecovery } from "@/lib/actions/recoveries";
import type { Recovery } from "@/lib/api/reclaim-pay-types";
import { formatClaimRef, formatMoney } from "@/lib/format";
import { ErrorLine, Sheet, btnBase } from "@/components/ui/Sheet";
import { recoveryErrorMessage, type HRRecovery } from "./recoveries";

const WAIVE_FAILED = "Couldn't waive this recovery. Check your connection and try again.";

export default function WaiveDialog({
  recovery,
  onClose,
  onWaived,
  onRejected,
}: {
  /** The recovery to waive; null keeps the dialog closed. */
  recovery: HRRecovery | null;
  onClose: () => void;
  onWaived: (recovery: Recovery) => void;
  onRejected: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!recovery) return;
    setBusy(true);
    setError(null);
    try {
      const res = await waiveRecovery(recovery.recovery_id);
      if (res.recovery) {
        onWaived(res.recovery);
        return;
      }
      setError(recoveryErrorMessage(res.error, WAIVE_FAILED));
      onRejected();
    } catch {
      setError(WAIVE_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const money = recovery ? formatMoney(recovery.currency, recovery.amount) : "";

  return (
    <Sheet open={recovery !== null} titleId="waive-title" title="Waive this recovery?" busy={busy} onClose={close}>
      {recovery && (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 text-sm">
            <p>
              {recovery.employee_name ?? "The employee"} won&apos;t owe {money} on claim {formatClaimRef(recovery.reim_id)}, and
              they&apos;ll be told so. You can&apos;t undo this.
            </p>
            {recovery.dispute_note && (
              <p className="rounded-lg bg-surface-container-low px-3 py-2.5 break-words">
                <span className="font-medium">Employee replied:</span> {recovery.dispute_note}
              </p>
            )}
            <ErrorLine error={error} />
          </div>
          <footer className="flex flex-col-reverse gap-2 px-5 py-4 border-t border-outline-variant/20 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} disabled={busy} className={`${btnBase} text-on-surface hover:bg-surface-container focus-visible:outline-primary`}>
              Keep the recovery
            </button>
            <button type="button" onClick={confirm} disabled={busy} className={`${btnBase} bg-error text-on-error hover:bg-error-dim focus-visible:outline-error`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Waive {money}
            </button>
          </footer>
        </>
      )}
    </Sheet>
  );
}
