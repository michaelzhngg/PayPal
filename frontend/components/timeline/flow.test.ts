import { describe, it, expect } from "vitest";
import { displayTier, flowState } from "./flow";

describe("flowState", () => {
  it("auto-pay in flight", () => expect(flowState("AUTO_PAY", "REQUESTED")).toEqual(["done", "done", "done", "active", "pending"]));
  it("paid", () => expect(flowState("AUTO_PAY", "SUCCEEDED")).toEqual(["done", "done", "done", "done", "done"]));
  it("waiting for HR", () => expect(flowState("HR_REVIEW", null)).toEqual(["done", "done", "waiting", "pending", "pending"]));
  it("payout failed", () => expect(flowState("AUTO_PAY", "FAILED")).toEqual(["done", "done", "done", "error", "pending"]));
  it("approved by HR, then paid", () => expect(flowState("HR_QUICK", "SUCCEEDED")).toEqual(["done", "done", "done", "done", "done"]));
  it("reversed counts as failed", () => expect(flowState("AUTO_PAY", "REVERSED")).toEqual(["done", "done", "done", "error", "pending"]));
});

describe("displayTier", () => {
  it("a claim with a payout is on the paid path", () => expect(displayTier("REVIEW", true)).toBe("AUTO_PAY"));
  it("an approved claim is on the paid path", () => expect(displayTier("APPROVED", false)).toBe("AUTO_PAY"));
  it("a claim under review is with HR", () => expect(displayTier("REVIEW", false)).toBe("HR_REVIEW"));
});
