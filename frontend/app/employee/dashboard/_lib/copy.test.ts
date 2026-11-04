import { describe, it, expect } from "vitest";
import type { Recovery, TrustInfo } from "@/lib/api/reclaim-pay-types";
import {
  deadlineLine,
  formatDeadline,
  formatLimit,
  isDisputeOpen,
  noticeLine,
  trustLimitedLine,
  trustLine,
  trustProgress,
} from "./copy";

const KL = "Asia/Kuala_Lumpur";

const standard: TrustInfo = {
  trust_tier: "STANDARD", auto_limit: 100, paid_claims: 8, next_tier: "TRUSTED",
  claims_to_next_tier: 2, reasons: [], currency: "MYR", next_limit: 200,
};

const recovery: Recovery = {
  recovery_id: "rec-1", reim_id: "1a2b3c4d-0000-4000-8000-000000000000", user_id: "u-1",
  amount: 30, currency: "MYR", reason: "Breakfast was included in the hotel rate and also claimed separately",
  status: "NOTICE_SENT", dispute_until: "2026-11-08T10:00:00Z", dispute_note: null,
  offset_reim_id: null, paypal_invoice_id: null, created_at: "2026-11-03T10:00:00Z", updated_at: "2026-11-03T10:00:00Z",
};

describe("trust line", () => {
  it("reads the way the UX report writes it", () => {
    expect(trustLine(standard)).toBe("Instant payouts up to MYR 100 · 2 more approved claims to reach MYR 200");
  });
  it("uses the singular for one claim", () => {
    expect(trustLine({ ...standard, claims_to_next_tier: 1 })).toBe(
      "Instant payouts up to MYR 100 · 1 more approved claim to reach MYR 200");
  });
  it("names the next tier when the backend leaves out its limit", () => {
    expect(trustLine({ ...standard, next_limit: undefined, currency: undefined })).toBe(
      "Instant payouts up to MYR 100 · 2 more approved claims to reach Trusted");
  });
  it("says so plainly at the top tier", () => {
    const top: TrustInfo = { ...standard, trust_tier: "TRUSTED", auto_limit: 200, next_tier: null, claims_to_next_tier: null };
    expect(trustLine(top)).toBe("Instant payouts up to MYR 200 · This is the highest level.");
    expect(trustProgress(top)).toBe(1);
  });
  it("keeps cents only when the limit has them", () => {
    expect(formatLimit("MYR", 100)).toBe("MYR 100");
    expect(formatLimit("MYR", 87.5)).toBe("MYR 87.50");
  });
  it("measures progress from paid claims", () => {
    expect(trustProgress(standard)).toBeCloseTo(0.8);
    expect(trustProgress({ ...standard, paid_claims: 0, claims_to_next_tier: 0 })).toBe(0);
  });
});

describe("limited trust line", () => {
  const limited: TrustInfo = { ...standard, trust_tier: "NEW", auto_limit: 50, next_tier: "STANDARD", reasons: ["recent_recovery"] };
  it("only appears for a New employee with a recent correction", () => {
    expect(trustLimitedLine(standard)).toBeNull();
    expect(trustLimitedLine({ ...limited, reasons: [] })).toBeNull();
  });
  it("gives the end date when there is one", () => {
    expect(trustLimitedLine({ ...limited, limited_until: "2027-01-31T04:00:00Z" }, KL)).toBe(
      "Instant payouts are limited after a recent correction. They return to normal on 31 Jan.");
    expect(trustLimitedLine(limited)).toBe("Instant payouts are limited after a recent correction.");
  });
});

describe("overpayment notice copy", () => {
  it("states the amount and claim", () => {
    expect(noticeLine(recovery)).toBe("We paid MYR 30.00 more than approved on claim RC-1A2B3C4D.");
  });
  it("formats the deadline like the spec", () => {
    expect(formatDeadline("2026-11-08T10:00:00Z", KL)).toBe("8 Nov, 6:00 pm");
    expect(formatDeadline("2026-11-08T01:05:00Z", KL)).toBe("8 Nov, 9:05 am");
  });
  it("offers the dispute while the window is open", () => {
    const before = new Date("2026-11-05T00:00:00Z");
    expect(isDisputeOpen(recovery, before)).toBe(true);
    expect(deadlineLine(recovery, before, KL)).toBe("You can dispute until 8 Nov, 6:00 pm.");
  });
  it("says the window has closed once the deadline passes", () => {
    const after = new Date("2026-11-08T10:00:01Z");
    expect(isDisputeOpen(recovery, after)).toBe(false);
    expect(deadlineLine(recovery, after, KL)).toBe("The dispute window closed on 8 Nov, 6:00 pm.");
  });
});
