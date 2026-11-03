// ─── Payout Ledger Logic ─────────────────────────────────────────────────────
// Pure helpers for the HR payouts ledger: status labels, tier labels, filtering,
// sorting and the "still in flight" check that drives polling.
// ──────────────────────────────────────────────────────────────────────────────

import type { AutonomyTier, PayoutLedgerRow, PayoutStatus } from "@/lib/api/reclaim-pay-types";

export type StatusTone = "success" | "progress" | "danger" | "neutral";

export const STATUS_META: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  ACCEPTED: { label: "Accepted", tone: "progress" },
  REQUESTED: { label: "Processing", tone: "progress" },
  SUCCEEDED: { label: "Paid", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  REVERSED: { label: "Reversed", tone: "danger" },
};

export const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  progress: "bg-amber-50 text-amber-900 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-surface-container text-on-surface-variant border-outline-variant/30",
};

const TIER_LABELS: Record<AutonomyTier, string> = {
  AUTO_PAY: "Auto-pay",
  HR_QUICK: "HR quick check",
  HR_REVIEW: "HR review",
  DUAL_REVIEW: "Two-person review",
};

/** The backend leaves `tier` empty until the autonomy engine records one. */
export function tierLabel(tier: AutonomyTier | null): string {
  return tier ? TIER_LABELS[tier] : "Not recorded";
}

export const IN_FLIGHT_STATUSES: readonly PayoutStatus[] = ["ACCEPTED", "REQUESTED"];

export function hasInFlight(rows: PayoutLedgerRow[]): boolean {
  return rows.some((r) => IN_FLIGHT_STATUSES.includes(r.status));
}

export type StatusFilter = PayoutStatus | "ALL";

export function filterByStatus(rows: PayoutLedgerRow[], status: StatusFilter): PayoutLedgerRow[] {
  return status === "ALL" ? rows : rows.filter((r) => r.status === status);
}

export function sortByUpdatedDesc(rows: PayoutLedgerRow[]): PayoutLedgerRow[] {
  return [...rows].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export function formatUpdated(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

/** Counts shown in the page summary line, computed from the rows themselves. */
export function summarize(rows: PayoutLedgerRow[]): { total: number; inFlight: number; failed: number } {
  return {
    total: rows.length,
    inFlight: rows.filter((r) => IN_FLIGHT_STATUSES.includes(r.status)).length,
    failed: rows.filter((r) => r.status === "FAILED" || r.status === "REVERSED").length,
  };
}
