import { describe, expect, it } from "vitest";
import type { RecoveryStatus } from "@/lib/api/reclaim-pay-types";
import type { TriageSource } from "./rows";
import {
  auditAction,
  canPreview,
  canWaive,
  disputeHint,
  errorNeedsNewPreview,
  recoveryErrorMessage,
  recoveryOutcomeNote,
  toAuditRows,
  validateRecovery,
} from "./recoveries";

const CODES = [
  "AMOUNT_EXCEEDS_APPROVED",
  "NOT_PAID",
  "SELF_RECOVERY",
  "DISPUTE_WINDOW_OPEN",
  "DISPUTED",
  "NOT_EXECUTABLE",
  "PREVIEW_REQUIRED",
  "PREVIEW_STALE",
  "NOT_WAIVABLE",
  "PAYPAL_INVOICE_FAILED",
];

describe("recoveryErrorMessage", () => {
  it.each(CODES)("gives %s a sentence with no raw code in it", (code) => {
    const message = recoveryErrorMessage(code, "fallback");
    expect(message).not.toBe("fallback");
    expect(message).not.toMatch(/[A-Z]+_[A-Z]+/);
    expect(message).toMatch(/\.$/);
  });

  it("uses the fallback for anything unknown, so raw API text never shows", () => {
    expect(recoveryErrorMessage("SOMETHING_NEW", "Couldn't send.")).toBe("Couldn't send.");
    expect(recoveryErrorMessage('[{"loc":["body"]}]', "Couldn't send.")).toBe("Couldn't send.");
    expect(recoveryErrorMessage(null, "Couldn't send.")).toBe("Couldn't send.");
  });

  it("marks the two errors a new preview clears", () => {
    expect(errorNeedsNewPreview("PREVIEW_REQUIRED")).toBe(true);
    expect(errorNeedsNewPreview("PREVIEW_STALE")).toBe(true);
    expect(errorNeedsNewPreview("DISPUTED")).toBe(false);
  });
});

describe("row actions", () => {
  const table: [RecoveryStatus, boolean, boolean][] = [
    ["NOTICE_SENT", true, true],
    ["DISPUTED", false, true],
    ["OFFSET", false, false],
    ["INVOICED", false, false],
    ["RECOVERED", false, false],
    ["WAIVED", false, false],
  ];
  it.each(table)("%s: preview %s, waive %s", (status, preview, waive) => {
    expect(canPreview(status)).toBe(preview);
    expect(canWaive(status)).toBe(waive);
  });
});

describe("disputeHint", () => {
  const now = new Date("2026-11-04T10:00:00Z");
  it("says whether the window is open while it still matters", () => {
    expect(disputeHint({ status: "NOTICE_SENT", dispute_until: "2026-11-05T10:00:00Z" }, now)).toBe("Window open");
    expect(disputeHint({ status: "NOTICE_SENT", dispute_until: "2026-11-03T10:00:00Z" }, now)).toBe("Window closed");
  });
  it("stays quiet once the recovery has moved on", () => {
    expect(disputeHint({ status: "WAIVED", dispute_until: "2026-11-05T10:00:00Z" }, now)).toBeNull();
  });
});

describe("recoveryOutcomeNote", () => {
  it("names the claim an offset came from", () => {
    expect(
      recoveryOutcomeNote({ status: "OFFSET", offset_reim_id: "9c8b7a6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", paypal_invoice_id: null }),
    ).toBe("Deducted from claim RC-9C8B7A6D");
  });
  it("names the invoice", () => {
    expect(recoveryOutcomeNote({ status: "INVOICED", offset_reim_id: null, paypal_invoice_id: "INV2-1" })).toBe("PayPal invoice INV2-1");
  });
  it("adds nothing for an open recovery", () => {
    expect(recoveryOutcomeNote({ status: "NOTICE_SENT", offset_reim_id: null, paypal_invoice_id: null })).toBeNull();
  });
});

describe("toAuditRows", () => {
  const claim = {
    reim_id: "d6f5b4c3-0e9a-4f81-82bd-4e5f6a7b8c93",
    employee_name: "Priya Nair",
    main_category: "Meals",
    total_approved_amount: 64,
    total_claimed_amount: 70,
    currency: "MYR",
    status: "PAID",
    created_at: "2026-11-04T02:00:00Z",
  } as TriageSource;

  it("subtracts open recoveries from what can still be recovered, ignoring waived ones", () => {
    const [row] = toAuditRows([claim], [
      { reim_id: claim.reim_id, amount: 10.1, status: "NOTICE_SENT" },
      { reim_id: claim.reim_id, amount: 20.2, status: "INVOICED" },
      { reim_id: claim.reim_id, amount: 30, status: "WAIVED" },
      { reim_id: "someone-else", amount: 5, status: "NOTICE_SENT" },
    ]);
    expect(row.ref).toBe("RC-D6F5B4C3");
    expect(row.inRecovery).toBe(30.3);
    expect(row.remaining).toBe(33.7);
    expect(auditAction(row)).toBe("record");
  });

  it("stops offering a recovery once the whole claim is covered", () => {
    const [row] = toAuditRows([claim], [{ reim_id: claim.reim_id, amount: 64, status: "NOTICE_SENT" }]);
    expect(row.remaining).toBe(0);
    expect(auditAction(row)).toBe("fully_in_recovery");
  });

  it("doesn't offer a recovery on a claim that hasn't finished paying", () => {
    const [row] = toAuditRows([{ ...claim, status: "DISBURSING" } as TriageSource], []);
    expect(auditAction(row)).toBe("not_paid");
  });
});

describe("validateRecovery", () => {
  it("accepts an amount up to what is still open", () => {
    expect(validateRecovery("30", "Breakfast counted twice", 64, "MYR")).toBeNull();
    expect(validateRecovery("64.00", "Breakfast counted twice", 64, "MYR")).toBeNull();
  });
  it.each([
    ["", "reason"],
    ["abc", "reason"],
    ["1.234", "reason"],
    ["-4", "reason"],
    ["0", "reason"],
    ["64.01", "reason"],
    ["30", "   "],
  ])("rejects amount %j with reason %j", (amount, reason) => {
    expect(validateRecovery(amount, reason, 64, "MYR")).toEqual(expect.any(String));
  });
});
