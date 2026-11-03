import type { AutonomyTier, PayoutStatus } from "@/lib/api/reclaim-pay-types";

export type NodeState = "done" | "active" | "waiting" | "error" | "pending";

export const FLOW_NODES = ["Receipt read", "Policy checked", "Guardrails", "PayPal", "In your account"] as const;

const FAILED: readonly string[] = ["FAILED", "CANCELLED", "REVERSED"];

/**
 * State of each money-flow node. A claim outside AUTO_PAY waits at Guardrails
 * until HR approves it, which is when a payout exists.
 */
export function flowState(tier: AutonomyTier, payoutStatus: PayoutStatus | string | null): NodeState[] {
  if (tier !== "AUTO_PAY" && payoutStatus === null) {
    return ["done", "done", "waiting", "pending", "pending"];
  }
  if (payoutStatus === "SUCCEEDED") return ["done", "done", "done", "done", "done"];
  if (payoutStatus !== null && FAILED.includes(payoutStatus)) return ["done", "done", "done", "error", "pending"];
  return ["done", "done", "done", "active", "pending"];
}

/**
 * Display tier until reimbursements carry a real `tier` field (Chingiz B, AU-3).
 * Replace callers with `claim.tier` when it lands.
 */
export function displayTier(claimStatus: string, hasPayout: boolean): AutonomyTier {
  if (hasPayout) return "AUTO_PAY";
  return ["APPROVED", "DISBURSING", "PAID", "DISBURSEMENT_FAILED"].includes(claimStatus) ? "AUTO_PAY" : "HR_REVIEW";
}
