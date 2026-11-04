import { describe, it, expect } from "vitest";
import { formatMoney } from "@/lib/api/reclaim-pay-types";
import { decisions, ledgerRows, payeeVariants, recoveryVariants, timelineS1, timelineS4, trustVariants } from "./reclaimPayFixtures";

describe("timeline fixtures follow the spec", () => {
  it("S1 runs every step in spec order and ends in AUTO_PAY", () => {
    expect(timelineS1.filter(e => e.status === "done").map(e => e.step)).toEqual([
      "policy.load", "receipt.analyze", "shield.injection", "shield.duplicate", "shield.provenance",
      "shield.arithmetic", "shield.split", "totals.aggregate", "judgment.final", "autonomy.decide", "payout.create"]);
    expect(decisions.S1.tier).toBe("AUTO_PAY");
  });
  it("S4 warns on injection and needs two people", () => {
    expect(timelineS4.find(e => e.step === "shield.injection" && e.status !== "running")?.status).toBe("warn");
    expect(decisions.S4.tier).toBe("DUAL_REVIEW");
  });
  it("every tier appears in the demo decisions", () => {
    expect(new Set(Object.values(decisions).map(d => d.tier)))
      .toEqual(new Set(["AUTO_PAY", "HR_QUICK", "HR_REVIEW", "DUAL_REVIEW"]));
  });
  it("S1's decision detail mirrors the backend string", () => {
    expect(timelineS1.find(e => e.step === "autonomy.decide" && e.status === "done")?.detail)
      .toBe("Auto-pay — risk 0/100, Standard employee limit MYR 100.00.");
  });
});

describe("PayPal fixtures follow the backend contract", () => {
  it("cover every Connect PayPal card state", () => {
    expect(payeeVariants.notLinked.linked).toBe(false);
    expect(payeeVariants.verified.verified).toBe(true);
    expect(payeeVariants.coolDown.cooldown_until).not.toBeNull();
    expect(payeeVariants.unverified.verified).toBe(false);
  });

  it("include a failed payout followed by a successful retry", () => {
    const attempts = ledgerRows.filter(r => r.claim_ref === "RC-2a3b4c5d").map(r => [r.attempt, r.status]);
    expect(attempts).toEqual([[1, "FAILED"], [2, "SUCCEEDED"]]);
  });
});

describe("formatMoney", () => {
  it("matches the backend's notification format", () => {
    expect(formatMoney("MYR", 48)).toBe("MYR 48.00");
    expect(formatMoney("MYR", 1150)).toBe("MYR 1,150.00");
  });
});

describe("trust and recovery fixtures follow the backend contract", () => {
  it("cover the fast-track card states", () => {
    expect(trustVariants.standard?.next_tier).toBe("TRUSTED");
    expect(trustVariants.trusted?.next_tier).toBeNull();
    expect(trustVariants.limited?.reasons.length).toBeGreaterThan(0);
    expect(trustVariants.none).toBeNull();
  });
  it("hold no risk scores or signal names", () => {
    const text = JSON.stringify(trustVariants);
    expect(text).not.toMatch(/risk_score|signals|PROMPT_INJECTION|DUPLICATE_RECEIPT/);
  });
  it("open the dispute window only on the open notice", () => {
    const now = Date.now();
    expect(new Date(recoveryVariants.open![0].dispute_until).getTime()).toBeGreaterThan(now);
    expect(new Date(recoveryVariants.closed![0].dispute_until).getTime()).toBeLessThan(now);
    expect(recoveryVariants.open![0].status).toBe("NOTICE_SENT");
  });
});
