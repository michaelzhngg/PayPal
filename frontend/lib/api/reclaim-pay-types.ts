// ─── Reclaim Pay Types ───────────────────────────────────────────────────────
// Mirrors the backend contracts in docs/superpowers/specs/2026-11-02-reclaim-pay-hackathon-design.md.
// Only the PayPal and payout types exist so far; autonomy, timeline and recovery
// types join this file when their endpoints land.
// ──────────────────────────────────────────────────────────────────────────────

export type AutonomyTier = "AUTO_PAY" | "HR_QUICK" | "HR_REVIEW" | "DUAL_REVIEW";

export type PayoutStatus =
  | "ACCEPTED"
  | "REQUESTED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REVERSED";

export const TERMINAL_PAYOUT_STATUSES: readonly PayoutStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REVERSED",
];

/** GET /paypal/status */
export interface PayeeStatus {
  linked: boolean;
  email_masked: string | null;
  verified: boolean;
  linked_at: string | null;
  cooldown_until: string | null;
}

/** GET /payouts/{reim_id} */
export interface PayoutInfoV2 {
  payout_id: string;
  reim_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: string;
  provider_batch_id: string | null;
  provider_item_id: string | null;
  attempt: number;
  reference_id: string;
  channel_code: string;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /payouts/ (HR ledger) */
export interface PayoutLedgerRow {
  payout_id: string;
  reim_id: string;
  claim_ref: string;
  employee_name: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  tier: AutonomyTier | null;
  provider_batch_id: string | null;
  provider_item_id: string | null;
  attempt: number;
  audit_selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface LedgerFilters {
  status?: PayoutStatus;
  from?: string;
  to?: string;
}

/** Formats an amount the way the backend writes it in notifications, e.g. "MYR 48.00". */
export function formatMoney(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
