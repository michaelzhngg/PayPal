import { describe, it, expect } from "vitest";
import { linkChangesPausedUntil, payeeCardState } from "./payeeCardState";
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

describe("linkChangesPausedUntil", () => {
  const later = new Date(now.getTime() + 3_600_000).toISOString();

  it("is null in a password session", () => {
    expect(linkChangesPausedUntil(payeeVariants.verified, now)).toBeNull();
  });

  it("returns the end of the pause after a PayPal sign-in", () => {
    expect(linkChangesPausedUntil({ ...payeeVariants.verified, link_changes_paused_until: later }, now)).toBe(later);
  });

  it("is null once the pause has ended", () => {
    const ended = new Date(now.getTime() - 60_000).toISOString();
    expect(linkChangesPausedUntil({ ...payeeVariants.verified, link_changes_paused_until: ended }, now)).toBeNull();
  });

  it("doesn't change which card shows: instant payouts stay on", () => {
    expect(payeeCardState({ ...payeeVariants.verified, link_changes_paused_until: later }, now)).toBe("verified");
  });
});
