// ─── Triage fixtures ─────────────────────────────────────────────────────────
// The S1–S8 demo claims as GET /reimbursements/ returns them, plus two quick
// claims so batch approval has something to exclude. Dates are relative to load
// time so the "last 24 hours" window always holds the auto-paid rows.
// ──────────────────────────────────────────────────────────────────────────────

import type { AutonomyDecision, BatchApproveResult } from "@/lib/api/reclaim-pay-types";
import type { TriageSource } from "@/components/hr-grid/rows";
import { decisions, payoutS1 } from "./reclaimPayFixtures";

/** Stands in for the signed-in HR user in fixture mode, so the self-claim exclusion shows. */
export const FIXTURE_HR_USER_ID = "0000a11c-0000-4000-8000-000000000001";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const EMPLOYEES = {
  aisyah: { user_id: "70a8e9da-549a-4718-b854-23164e464be0", employee_name: "Aisyah Rahman", department_name: "Sales" },
  daniel: { user_id: "3b9c1d2e-4f5a-4b6c-8d7e-9f0a1b2c3d4e", employee_name: "Daniel Lim", department_name: "Engineering" },
  priya: { user_id: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b", employee_name: "Priya Nair", department_name: "Marketing" },
  hr: { user_id: FIXTURE_HR_USER_ID, employee_name: "Demo HR", department_name: "People" },
};

interface Spec {
  reim_id: string;
  who: keyof typeof EMPLOYEES;
  category: string;
  amount: number;
  judgment: TriageSource["judgment"];
  confidence: number;
  status: TriageSource["status"];
  decision: AutonomyDecision;
  minutes: number;
  approvals?: TriageSource["approvals"];
  /** What the AI found eligible when it is less than the claimed amount. */
  eligible?: number;
}

function claim(s: Spec): TriageSource {
  return {
    ...EMPLOYEES[s.who],
    reim_id: s.reim_id,
    policy_id: null,
    policy_name: "Reclaim Pay Demo Travel Policy",
    settlement_id: null,
    main_category: s.category,
    currency: "MYR",
    total_claimed_amount: s.amount,
    total_approved_amount: s.status === "PAID" ? s.amount : null,
    total_rejected_amount: null,
    judgment: s.judgment,
    confidence: s.confidence,
    ai_reasoning: {},
    status: s.status,
    summary: s.decision.explanation,
    reviewed_by: null,
    created_at: minutesAgo(s.minutes),
    sub_categories: [],
    receipt_count: 1,
    // One receipt per claim, so the review page has a line to decide on.
    line_items: [{
      line_item_id: `${s.reim_id}-li-1`,
      reim_id: s.reim_id,
      document_id: `${s.reim_id}-doc-1`,
      description: `${s.category} receipt`,
      category: s.category,
      claimed_amount: s.amount,
      approved_amount: s.eligible ?? s.amount,
      currency: "MYR",
      expense_date: minutesAgo(s.minutes).slice(0, 10),
      judgment: s.judgment,
    }],
    tier: s.decision.tier,
    risk_score: s.decision.risk_score,
    autonomy: s.decision,
    audit_selected: s.decision.audit_selected,
    approvals: s.approvals ?? [],
  };
}

const quickDecision = (over: Partial<AutonomyDecision>): AutonomyDecision => ({ ...decisions.S7, ...over });

export const triageReimbursements: TriageSource[] = [
  claim({ reim_id: payoutS1.reim_id, who: "aisyah", category: "Transportation", amount: 48, judgment: "APPROVED", confidence: 0.95, status: "PAID", decision: decisions.S1, minutes: 190 }),
  claim({ reim_id: "8d4a1b2c-3e5f-4a6b-8c7d-9e0f1a2b3c4d", who: "daniel", category: "Accommodation", amount: 620, eligible: 250, judgment: "PARTIAL", confidence: 0.9, status: "REVIEW", decision: decisions.S2, minutes: 170 }),
  claim({
    reim_id: "a3c2e1f0-7b6d-4c5e-9f8a-1b2c3d4e5f60", who: "priya", category: "Accommodation", amount: 450, judgment: "APPROVED", confidence: 0.8, status: "REVIEW", decision: decisions.S3, minutes: 150,
    approvals: [{ hr_id: "c0ffee00-0000-4000-8000-0000000000aa", at: minutesAgo(30) }],
  }),
  claim({ reim_id: "b4d3f2a1-8c7e-4d6f-a09b-2c3d4e5f6a71", who: "aisyah", category: "Meals", amount: 95, judgment: "APPROVED", confidence: 1, status: "REVIEW", decision: decisions.S4, minutes: 130 }),
  claim({ reim_id: "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a", who: "daniel", category: "Transportation", amount: 48, judgment: "APPROVED", confidence: 0.97, status: "REVIEW", decision: decisions.S5, minutes: 110 }),
  claim({ reim_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", who: "aisyah", category: "Meals", amount: 90, judgment: "APPROVED", confidence: 0.93, status: "REVIEW", decision: decisions.S6, minutes: 90 }),
  claim({ reim_id: "c5e4a3b2-9d8f-4e70-b1ac-3d4e5f6a7b82", who: "daniel", category: "Transportation", amount: 48, judgment: "APPROVED", confidence: 0.96, status: "REVIEW", decision: decisions.S7, minutes: 70 }),
  claim({ reim_id: "d6f5b4c3-0e9a-4f81-82bd-4e5f6a7b8c93", who: "priya", category: "Meals", amount: 64, judgment: "APPROVED", confidence: 0.94, status: "PAID", decision: decisions.S8, minutes: 60 }),
  claim({
    reim_id: "e7a6c5d4-1f0b-4a92-93ce-5f6a7b8c9da4", who: "priya", category: "Transportation", amount: 60, judgment: "APPROVED", confidence: 0.95, status: "REVIEW", minutes: 45,
    decision: quickDecision({ trust_tier: "NEW", auto_limit: 50, hard_stops: ["OVER_AUTO_LIMIT"], explanation: "Quick HR approval: MYR 60.00 is above the New employee limit of MYR 50.00." }),
  }),
  claim({
    reim_id: "f8b7d6e5-2a1c-4ba3-a4df-6a7b8c9d0eb5", who: "hr", category: "Meals", amount: 42, judgment: "APPROVED", confidence: 0.96, status: "REVIEW", minutes: 20,
    decision: quickDecision({ hard_stops: ["HR_SELF_CLAIM"], explanation: "Quick HR approval: claim submitted by an HR user." }),
  }),
];

/** What the backend would answer for these fixtures. */
export function fixtureBatchApprove(reimIds: string[]): BatchApproveResult {
  const byId = new Map(triageReimbursements.map((r) => [r.reim_id, r]));
  const result: BatchApproveResult = { approved: [], skipped: [] };
  for (const id of reimIds) {
    const r = byId.get(id);
    if (!r || r.tier !== "HR_QUICK") result.skipped.push({ reim_id: id, reason: "NOT_HR_QUICK" });
    else if (r.status !== "REVIEW") result.skipped.push({ reim_id: id, reason: "NOT_IN_REVIEW" });
    else if (r.user_id === FIXTURE_HR_USER_ID) result.skipped.push({ reim_id: id, reason: "SELF_APPROVAL" });
    else result.approved.push(id);
  }
  return result;
}
