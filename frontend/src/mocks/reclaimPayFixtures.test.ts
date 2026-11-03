import { describe, it, expect } from "vitest";
import { formatMoney } from "@/lib/api/reclaim-pay-types";
import { ledgerRows, payeeVariants } from "./reclaimPayFixtures";

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
