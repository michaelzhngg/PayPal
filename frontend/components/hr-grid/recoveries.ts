// Pure helpers for the Audit queue and Recoveries tabs on the HR payouts page.

import type { Recovery, RecoveryStatus } from "@/lib/api/reclaim-pay-types";
import { formatClaimRef } from "@/lib/format";
import { STATUS_LABEL, type TriageSource } from "./rows";
import type { StatusTone } from "./ledger";

export type HRRecovery = Recovery & { employee_name: string | null };

export const RECOVERY_STATUS_META: Record<RecoveryStatus, { label: string; tone: StatusTone }> = {
  NOTICE_SENT: { label: "Notice sent", tone: "progress" },
  DISPUTED: { label: "Disputed", tone: "danger" },
  OFFSET: { label: "Deducted", tone: "success" },
  INVOICED: { label: "Invoiced", tone: "progress" },
  RECOVERED: { label: "Recovered", tone: "success" },
  WAIVED: { label: "Waived", tone: "neutral" },
};

const ERROR_TEXT: Record<string, string> = {
  AMOUNT_EXCEEDS_APPROVED: "That is more than the amount still open on this claim. Enter a smaller amount.",
  NOT_PAID: "This claim hasn't finished paying out, so there's nothing to recover yet.",
  SELF_RECOVERY: "This is your own claim. Another HR member has to handle this recovery.",
  DISPUTE_WINDOW_OPEN: "The employee can still dispute this, so it can't be sent until the dispute window closes.",
  DISPUTED: "The employee disputed this recovery, so it can't be sent. You can only waive it.",
  NOT_EXECUTABLE: "This recovery is already settled or waived, so there's nothing left to send.",
  PREVIEW_REQUIRED: "Preview the invoice before sending it.",
  PREVIEW_STALE: "The employee's PayPal email changed after this preview. Preview the invoice again before sending it.",
  NOT_WAIVABLE: "This recovery is already settled or waived, so it can't be waived now.",
  PAYPAL_INVOICE_FAILED: "PayPal couldn't send the invoice. The recovery is still open, so you can try again.",
};

/** Plain sentence for an API error. Anything unrecognised gets `fallback`, so a raw code never reaches the screen. */
export function recoveryErrorMessage(code: string | null | undefined, fallback: string): string {
  return (code && ERROR_TEXT[code]) || fallback;
}

/** These errors mean the row on screen is out of date, so the list should reload behind the dialog. */
export function errorChangesRow(code: string | null | undefined): boolean {
  return code === "DISPUTED" || code === "NOT_EXECUTABLE" || code === "NOT_WAIVABLE";
}

/** A fresh preview clears these. */
export function errorNeedsNewPreview(code: string | null | undefined): boolean {
  return code === "PREVIEW_REQUIRED" || code === "PREVIEW_STALE";
}

export function canPreview(status: RecoveryStatus): boolean {
  return status === "NOTICE_SENT";
}

export function canWaive(status: RecoveryStatus): boolean {
  return status === "NOTICE_SENT" || status === "DISPUTED";
}

export function disputeWindowOpen(disputeUntil: string, now = new Date()): boolean {
  return Date.parse(disputeUntil) > now.getTime();
}

export function isHrActionable(status: RecoveryStatus): boolean {
  return canPreview(status) || canWaive(status);
}

/** Dispute deadline hint, only while the deadline still decides what HR can do. */
export function disputeHint(recovery: Pick<Recovery, "status" | "dispute_until">, now = new Date()): string | null {
  if (recovery.status !== "NOTICE_SENT") return null;
  return disputeWindowOpen(recovery.dispute_until, now) ? "Window open" : "Window closed";
}

/** What the outcome column adds to the reason HR wrote. */
export function recoveryOutcomeNote(recovery: Pick<Recovery, "status" | "offset_reim_id" | "paypal_invoice_id">): string | null {
  if (recovery.status === "OFFSET" && recovery.offset_reim_id) return `Deducted from claim ${formatClaimRef(recovery.offset_reim_id)}`;
  if ((recovery.status === "INVOICED" || recovery.status === "RECOVERED") && recovery.paypal_invoice_id) {
    return `PayPal invoice ${recovery.paypal_invoice_id}`;
  }
  return null;
}

export interface AuditRow {
  reimId: string;
  ref: string;
  employee: string;
  category: string;
  /** What was approved and paid: the ceiling for all recoveries on this claim together. */
  approved: number;
  currency: string;
  status: TriageSource["status"];
  statusLabel: string;
  submittedAt: string | null;
  /** Sum of the claim's recoveries that haven't been waived. */
  inRecovery: number;
  /** What a new recovery may still ask for. */
  remaining: number;
}

const toCents = (n: number) => Math.round(n * 100);

export function toAuditRows(claims: TriageSource[], recoveries: Pick<Recovery, "reim_id" | "amount" | "status">[]): AuditRow[] {
  return claims.map((c) => {
    const approved = c.total_approved_amount ?? c.total_claimed_amount ?? 0;
    const inRecoveryCents = recoveries
      .filter((r) => r.reim_id === c.reim_id && r.status !== "WAIVED")
      .reduce((sum, r) => sum + toCents(r.amount), 0);
    return {
      reimId: c.reim_id,
      ref: formatClaimRef(c.reim_id),
      employee: c.employee_name ?? "Unknown",
      category: c.main_category ?? "General",
      approved,
      currency: c.currency ?? "MYR",
      status: c.status,
      statusLabel: STATUS_LABEL[c.status] ?? "In progress",
      submittedAt: c.created_at,
      inRecovery: inRecoveryCents / 100,
      remaining: Math.max(toCents(approved) - inRecoveryCents, 0) / 100,
    };
  });
}

export type AuditAction = "record" | "fully_in_recovery" | "not_paid";

export function auditAction(row: Pick<AuditRow, "status" | "remaining">): AuditAction {
  if (row.status !== "PAID") return "not_paid";
  return row.remaining > 0 ? "record" : "fully_in_recovery";
}

/** Validates the Record overpayment form. Returns a sentence for the first problem, or null when it can be sent. */
export function validateRecovery(amountText: string, reason: string, remaining: number, currency: string): string | null {
  const text = amountText.trim();
  if (!text) return "Enter the amount that was overpaid.";
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "Enter the amount as a number with up to 2 decimal places.";
  const amount = Number(text);
  if (amount <= 0) return "The amount must be more than zero.";
  if (toCents(amount) > toCents(remaining)) {
    return `The amount can't be more than ${currency} ${remaining.toFixed(2)}, the part of this claim still open.`;
  }
  if (!reason.trim()) return "Add a reason. The employee sees it on the notice.";
  return null;
}
