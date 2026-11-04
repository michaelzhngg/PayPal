import { describe, it, expect } from "vitest";
import { isAwaitingSecondApproval } from "./SuccessModal";

describe("isAwaitingSecondApproval", () => {
  it("is true only when the backend says the first of two approvals was recorded", () => {
    expect(isAwaitingSecondApproval({ status: "REVIEW", awaiting_second_approval: true })).toBe(true);
    expect(isAwaitingSecondApproval({ status: "APPROVED" })).toBe(false);
    expect(isAwaitingSecondApproval({ awaiting_second_approval: "true" })).toBe(false);
    expect(isAwaitingSecondApproval(undefined)).toBe(false);
  });
});
