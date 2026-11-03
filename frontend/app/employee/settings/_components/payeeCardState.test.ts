import { describe, it, expect } from "vitest";
import { payeeCardState } from "./payeeCardState";
import { payeeVariants } from "@/src/mocks/reclaimPayFixtures";

const now = new Date();

describe("payeeCardState", () => {
  it("not linked", () => expect(payeeCardState(payeeVariants.notLinked, now)).toBe("notLinked"));
  it("linked and verified", () => expect(payeeCardState(payeeVariants.verified, now)).toBe("verified"));
  it("in cool-down", () => expect(payeeCardState(payeeVariants.coolDown, now)).toBe("coolDown"));
  it("linked but unverified", () => expect(payeeCardState(payeeVariants.unverified, now)).toBe("unverified"));

  it("treats an ended cool-down as verified", () => {
    const ended = { ...payeeVariants.coolDown, cooldown_until: new Date(now.getTime() - 60_000).toISOString() };
    expect(payeeCardState(ended, now)).toBe("verified");
  });

  it("shows not linked after unlinking, even with a cool-down still running", () => {
    const unlinked = { ...payeeVariants.coolDown, linked: false, verified: false, email_masked: null };
    expect(payeeCardState(unlinked, now)).toBe("notLinked");
  });
});
