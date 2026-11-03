// ─── Reclaim Pay Types ───────────────────────────────────────────────────────
// Mirrors the backend contracts in docs/superpowers/specs/2026-11-02-reclaim-pay-hackathon-design.md.
// Recovery, settings and back-test types join this file when their endpoints land.
// ──────────────────────────────────────────────────────────────────────────────

export type AutonomyTier = "AUTO_PAY" | "HR_QUICK" | "HR_REVIEW" | "DUAL_REVIEW";

export type TrustTier = "NEW" | "STANDARD" | "TRUSTED";

export type Severity = "LOW" | "MEDIUM" | "HIGH";

export type SignalCode =
  | "PROMPT_INJECTION"
  | "DUPLICATE_RECEIPT"
  | "AI_PROVENANCE"
  | "HUMAN_EDIT_HIGH"
  | "ARITHMETIC_MISMATCH"
  | "EDITING_SOFTWARE"
  | "SPLIT_CLAIM"
  | "VISUAL_ANOMALY"
  | "HUMAN_EDIT_MEDIUM"
  | "PRICE_ABOVE_MARKET"
  | "NEAR_THRESHOLD"
  | "NO_CAMERA_METADATA";

export type HardStop =
  | "AUTONOMY_PAUSED"
  | "CIRCUIT_BREAKER"
  | "AI_NOT_APPROVED"
  | "PAYEE_NOT_VERIFIED"
  | "PAYEE_COOLDOWN"
  | "HR_SELF_CLAIM"
  | "OVER_CATEGORY_BUDGET"
  | "OVER_AUTO_LIMIT"
  | "EMPLOYEE_DAILY_CAP"
  | "EMPLOYEE_MONTHLY_CAP"
  | "AGENT_DAILY_BUDGET"
  | "HIGH_RISK_SIGNAL"
  | "EXPECTED_LOSS";

export interface RiskSignal {
  code: SignalCode;
  severity: Severity;
  points: number;
  /** HR-facing wording. Never shown to the employee. */
  message: string;
  evidence: Record<string, unknown>;
  document_id: string | null;
}

/** Carried as `autonomy` on each reimbursement in the analysis `complete` event. */
export interface AutonomyDecision {
  tier: AutonomyTier;
  risk_score: number;
  confidence_points: number;
  trust_tier: TrustTier;
  auto_limit: number;
  hard_stops: HardStop[];
  signals: RiskSignal[];
  expected_loss: number;
  explanation: string;
  audit_selected: boolean;
  config_version: number;
}

/** Step ids in the order the backend runs them. */
export const TIMELINE_STEP_IDS = [
  "policy.load",
  "receipt.analyze",
  "shield.injection",
  "shield.duplicate",
  "shield.provenance",
  "shield.arithmetic",
  "shield.split",
  "totals.aggregate",
  "judgment.final",
  "autonomy.decide",
  "payout.create",
] as const;

export type TimelineStepId = (typeof TIMELINE_STEP_IDS)[number];

export type TimelineStatus = "running" | "done" | "warn" | "fail";

/** A `progress` event with `stage: "timeline"` on the analysis SSE stream. */
export interface TimelineEvent {
  stage: "timeline";
  step: TimelineStepId;
  label: string;
  status: TimelineStatus;
  detail: string | null;
  ts: string;
}

/** One row of the timeline as rendered, after the audience filter. */
export interface TimelineStepState {
  step: TimelineStepId;
  label: string;
  status: TimelineStatus;
  detail: string | null;
}

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
