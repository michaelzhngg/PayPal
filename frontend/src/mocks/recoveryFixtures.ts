// HR side of recoveries in fixture mode. State lives in this module, and the transitions and
// error codes follow backend/engine/services/recovery_service.py, so a demo behaves like the real API.
//
// RECLAIM_PAY_FIXTURE_PAYOUTS=empty starts every Payouts tab with nothing to show.
// RECLAIM_PAY_FIXTURE_EXECUTE_ERROR=<code> makes "Send via PayPal" answer with that error.

import type {
  Recovery,
  RecoveryInvoicePreview,
  RecoveryPath,
} from "@/lib/api/reclaim-pay-types";
import type { TriageSource } from "@/components/hr-grid/rows";
import { formatClaimRef } from "@/lib/format";
import { payoutS1 } from "./reclaimPayFixtures";
import { FIXTURE_HR_USER_ID, triageReimbursements } from "./triageFixtures";
import { recordFixtureAction } from "./autonomyFixtures";

export const FIXTURE_PAYOUTS_EMPTY = process.env.RECLAIM_PAY_FIXTURE_PAYOUTS === "empty";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

const S8 = "d6f5b4c3-0e9a-4f81-82bd-4e5f6a7b8c93";
const STILL_PAYING = "2c7d9e10-3b4a-4c5d-8e6f-7a8b9c0d1e2f";
const ALREADY_COVERED = "b1a29384-7564-4e3f-a2b1-c0d9e8f7a6b5";
/** Daniel's claim still waiting on HR, so a recovery from him offsets instead of invoicing. */
const OFFSET_TARGET = "8d4a1b2c-3e5f-4a6b-8c7d-9e0f1a2b3c4d";

/** Claims outside the triage fixtures borrow S1's shape, then override what differs. */
function auditClaim(reimId: string, over: Partial<TriageSource>): TriageSource {
  const base = triageReimbursements.find((r) => r.reim_id === reimId) ?? triageReimbursements[0];
  return { ...base, reim_id: reimId, audit_selected: true, ...over };
}

const claims: TriageSource[] = FIXTURE_PAYOUTS_EMPTY
  ? []
  : [
      auditClaim(S8, {}),
      auditClaim(payoutS1.reim_id, {}),
      auditClaim(STILL_PAYING, {
        employee_name: "Daniel Lim",
        user_id: "3b9c1d2e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
        main_category: "Transportation",
        total_approved_amount: 36,
        total_claimed_amount: 36,
        status: "DISBURSING",
      }),
      auditClaim(ALREADY_COVERED, {
        employee_name: "Priya Nair",
        user_id: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
        main_category: "Meals",
        total_approved_amount: 30,
        total_claimed_amount: 30,
        status: "PAID",
      }),
    ];

function recovery(over: Partial<Recovery> & Pick<Recovery, "recovery_id" | "reim_id" | "status" | "amount" | "reason">): Recovery {
  return {
    user_id: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
    currency: "MYR",
    dispute_until: hoursFromNow(96),
    dispute_note: null,
    offset_reim_id: null,
    paypal_invoice_id: null,
    created_at: hoursFromNow(-30),
    updated_at: hoursFromNow(-30),
    ...over,
  };
}

const DANIEL = "3b9c1d2e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

let recoveries: Recovery[] = FIXTURE_PAYOUTS_EMPTY
  ? []
  : [
      recovery({
        recovery_id: "fa000001-0000-4000-8000-000000000001",
        reim_id: ALREADY_COVERED,
        status: "NOTICE_SENT",
        amount: 30,
        reason: "The dinner was already covered by the conference ticket.",
      }),
      recovery({
        recovery_id: "fa000002-0000-4000-8000-000000000002",
        reim_id: "b4d3f2a1-8c7e-4d6f-a09b-2c3d4e5f6a71",
        status: "NOTICE_SENT",
        amount: 25,
        reason: "Breakfast was included in the hotel rate and also claimed separately.",
        dispute_until: hoursFromNow(-3),
      }),
      recovery({
        recovery_id: "fa000003-0000-4000-8000-000000000003",
        reim_id: "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a",
        user_id: DANIEL,
        status: "NOTICE_SENT",
        amount: 18,
        reason: "The return taxi was claimed twice on the same day.",
        dispute_until: hoursFromNow(-5),
      }),
      recovery({
        recovery_id: "fa000004-0000-4000-8000-000000000004",
        reim_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        status: "DISPUTED",
        amount: 40,
        reason: "The team lunch was above the per-person limit.",
        dispute_note: "Two clients joined that lunch, so the per-person amount was within the limit.",
      }),
      recovery({
        recovery_id: "fa000005-0000-4000-8000-000000000005",
        reim_id: "c5e4a3b2-9d8f-4e70-b1ac-3d4e5f6a7b82",
        user_id: DANIEL,
        status: "INVOICED",
        amount: 12,
        reason: "The parking receipt was claimed on two different trips.",
        paypal_invoice_id: "INV2-DEMO-0002",
        dispute_until: hoursFromNow(-48),
      }),
      recovery({
        recovery_id: "fa000006-0000-4000-8000-000000000006",
        reim_id: "e7a6c5d4-1f0b-4a92-93ce-5f6a7b8c9da4",
        status: "OFFSET",
        amount: 9.5,
        reason: "The toll was already paid by the company card.",
        offset_reim_id: OFFSET_TARGET,
        dispute_until: hoursFromNow(-72),
      }),
      recovery({
        recovery_id: "fa000007-0000-4000-8000-000000000007",
        reim_id: "a3c2e1f0-7b6d-4c5e-9f8a-1b2c3d4e5f60",
        status: "WAIVED",
        amount: 15,
        reason: "The hotel's city tax looked like a double charge.",
        dispute_until: hoursFromNow(-120),
      }),
    ];

const previewed = new Set<string>();

export function fixtureAuditClaims(): TriageSource[] {
  return structuredClone(claims);
}

export function fixtureEmployeeNames(): Record<string, string> {
  const all = [...triageReimbursements, ...claims];
  return Object.fromEntries(all.filter((r) => r.employee_name).map((r) => [r.reim_id, r.employee_name as string]));
}

export function fixtureHRRecoveries(): Recovery[] {
  return structuredClone(recoveries);
}

function pathFor(rec: Recovery): RecoveryPath {
  if (Date.parse(rec.dispute_until) > Date.now()) return "WAIT";
  return rec.user_id === DANIEL ? "OFFSET" : "INVOICE";
}

function find(id: string): Recovery | undefined {
  return recoveries.find((r) => r.recovery_id === id);
}

function update(id: string, change: Partial<Recovery>): Recovery {
  recoveries = recoveries.map((r) => (r.recovery_id === id ? { ...r, ...change, updated_at: new Date().toISOString() } : r));
  return structuredClone(find(id)!);
}

type Outcome = { recovery: Recovery | null; error: string | null };

export function fixtureCreateRecovery(reimId: string, amount: number, reason: string): Outcome {
  const claim = claims.find((c) => c.reim_id === reimId);
  if (!claim) return { recovery: null, error: "Reimbursement not found" };
  if (claim.status !== "PAID") return { recovery: null, error: "NOT_PAID" };
  const open = recoveries.filter((r) => r.reim_id === reimId && r.status !== "WAIVED").reduce((sum, r) => sum + r.amount, 0);
  if (open + amount > (claim.total_approved_amount ?? 0)) return { recovery: null, error: "AMOUNT_EXCEEDS_APPROVED" };
  const created = recovery({
    recovery_id: crypto.randomUUID(),
    reim_id: reimId,
    user_id: claim.user_id,
    status: "NOTICE_SENT",
    amount,
    reason,
    dispute_until: hoursFromNow(120),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  recoveries = [created, ...recoveries];
  recordFixtureAction("RECOVERY_CREATED", FIXTURE_HR_USER_ID, reimId, { recovery_id: created.recovery_id, amount: amount.toFixed(2) });
  return { recovery: structuredClone(created), error: null };
}

export function fixtureInvoicePreview(id: string): { preview: RecoveryInvoicePreview | null; error: string | null } {
  const rec = find(id);
  if (!rec) return { preview: null, error: "Recovery not found" };
  if (rec.status !== "NOTICE_SENT") return { preview: null, error: rec.status === "DISPUTED" ? "DISPUTED" : "NOT_EXECUTABLE" };
  previewed.add(id);
  const note = `We paid ${rec.currency} ${rec.amount.toFixed(2)} more than the approved amount for claim ${formatClaimRef(rec.reim_id)}: ${rec.reason} Please settle this invoice, or reply to dispute it.`;
  const preview = { note, amount: rec.amount, currency: rec.currency, recipient_email_masked: "a***@gmail.com", path: pathFor(rec) };
  recordFixtureAction("RECOVERY_PREVIEWED", FIXTURE_HR_USER_ID, rec.reim_id, {
    recovery_id: id, note, recipient_email_masked: preview.recipient_email_masked, path: preview.path,
  });
  return { preview, error: null };
}

export function fixtureExecuteRecovery(id: string): Outcome {
  const forced = process.env.RECLAIM_PAY_FIXTURE_EXECUTE_ERROR;
  if (forced) return { recovery: null, error: forced };
  const rec = find(id);
  if (!rec) return { recovery: null, error: "NOT_FOUND" };
  if (rec.status !== "NOTICE_SENT") return { recovery: null, error: rec.status === "DISPUTED" ? "DISPUTED" : "NOT_EXECUTABLE" };
  const path = pathFor(rec);
  if (path === "WAIT") return { recovery: null, error: "DISPUTE_WINDOW_OPEN" };
  if (path === "OFFSET") {
    recordFixtureAction("RECOVERY_STATUS", FIXTURE_HR_USER_ID, rec.reim_id, { recovery_id: id, from: "NOTICE_SENT", to: "OFFSET", offset_reim_id: OFFSET_TARGET });
    return { recovery: update(id, { status: "OFFSET", offset_reim_id: OFFSET_TARGET }), error: null };
  }
  if (!previewed.has(id)) return { recovery: null, error: "PREVIEW_REQUIRED" };
  const invoiceId = `INV2-DEMO-${id.slice(-4).toUpperCase()}`;
  recordFixtureAction("RECOVERY_INVOICED", FIXTURE_HR_USER_ID, rec.reim_id, { recovery_id: id, invoice_id: invoiceId });
  return { recovery: update(id, { status: "INVOICED", paypal_invoice_id: invoiceId }), error: null };
}

export function fixtureWaiveRecovery(id: string): Outcome {
  const rec = find(id);
  if (!rec) return { recovery: null, error: "Recovery not found" };
  if (rec.status !== "NOTICE_SENT" && rec.status !== "DISPUTED") return { recovery: null, error: "NOT_WAIVABLE" };
  recordFixtureAction("RECOVERY_STATUS", FIXTURE_HR_USER_ID, rec.reim_id, { recovery_id: id, from: rec.status, to: "WAIVED" });
  return { recovery: update(id, { status: "WAIVED" }), error: null };
}
