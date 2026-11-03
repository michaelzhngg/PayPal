import { describe, it, expect } from "vitest";
import { decisionsFrom, reduceTimeline } from "./useTimeline";
import { employeeTierCopy } from "@/components/timeline/copy";

const ev = (step: string, status: string, detail: string | null = null) =>
  ({ stage: "timeline", step, label: step, status, detail, ts: "2026-11-03T10:00:00Z" }) as any;

describe("reduceTimeline", () => {
  it("keeps first-seen order and lets the latest status win", () => {
    let s = reduceTimeline([], ev("policy.load", "running"), "employee");
    s = reduceTimeline(s, ev("receipt.analyze", "running"), "employee");
    s = reduceTimeline(s, ev("policy.load", "done"), "employee");
    expect(s.map(x => [x.step, x.status])).toEqual([["policy.load", "done"], ["receipt.analyze", "running"]]);
  });
  it("hides shield warnings from employees but not from HR", () => {
    const e = reduceTimeline([], ev("shield.injection", "warn", "matched: SYSTEM:"), "employee");
    expect(e[0]).toMatchObject({ status: "done", detail: null });
    const h = reduceTimeline([], ev("shield.injection", "warn", "matched: SYSTEM:"), "hr");
    expect(h[0]).toMatchObject({ status: "warn", detail: "matched: SYSTEM:" });
  });
});

describe("employeeTierCopy", () => {
  it("never reveals review reasons", () => {
    expect(employeeTierCopy("AUTO_PAY", "MYR 48.00")).toBe("Approved automatically. Sending MYR 48.00 to your PayPal.");
    expect(employeeTierCopy("HR_QUICK", "MYR 48.00")).toBe("Sent to HR for a quick check.");
    expect(employeeTierCopy("HR_REVIEW", "MYR 48.00")).toBe("Sent to HR for review.");
    expect(employeeTierCopy("DUAL_REVIEW", "MYR 48.00")).toBe("Sent to HR for review.");
  });
});

describe("reduceTimeline, employee audience", () => {
  it("drops the decision explanation, which names the checks that fired", () => {
    const e = reduceTimeline([], ev("autonomy.decide", "done", "Two-person review: hidden instructions"), "employee");
    expect(e[0].detail).toBeNull();
    const h = reduceTimeline([], ev("autonomy.decide", "done", "Two-person review: hidden instructions"), "hr");
    expect(h[0].detail).toBe("Two-person review: hidden instructions");
  });
  it("shows a shield check that failed to run as done", () => {
    expect(reduceTimeline([], ev("shield.duplicate", "fail", "lookup timed out"), "employee")[0]).toMatchObject({
      status: "done",
      detail: null,
    });
  });
  it("keeps details on non-shield steps", () => {
    expect(reduceTimeline([], ev("totals.aggregate", "done", "MYR 48.00 claimed"), "employee")[0].detail).toBe(
      "MYR 48.00 claimed",
    );
  });
});

describe("decisionsFrom", () => {
  it("reads autonomy from each reimbursement and skips empty ones", () => {
    const d = { tier: "AUTO_PAY", risk_score: 0 };
    expect(decisionsFrom({ reimbursements: [{ autonomy: d }, { autonomy: {} }, { autonomy: null }, {}] })).toEqual([d]);
  });
  it("handles a payload with no reimbursements", () => {
    expect(decisionsFrom({})).toEqual([]);
  });
});
