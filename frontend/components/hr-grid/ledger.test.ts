import { describe, it, expect } from "vitest";
import { ledgerRows } from "@/src/mocks/reclaimPayFixtures";
import {
  STATUS_META,
  filterByStatus,
  formatUpdated,
  hasAnyTier,
  hasInFlight,
  sortByUpdatedDesc,
  summarize,
  tierLabel,
} from "./ledger";

describe("payout ledger logic", () => {
  it("labels every backend status", () => {
    expect(STATUS_META.SUCCEEDED.label).toBe("Paid");
    expect(STATUS_META.REQUESTED.tone).toBe("progress");
    expect(STATUS_META.FAILED.tone).toBe("danger");
  });

  it("labels a missing tier instead of leaving the cell blank", () => {
    expect(tierLabel(null)).toBe("Not recorded");
    expect(tierLabel("DUAL_REVIEW")).toBe("Two-person review");
    expect(tierLabel("HR_QUICK")).toBe("Quick HR approval");
  });

  it("shows the Route column only once some payout has a tier", () => {
    expect(hasAnyTier(ledgerRows)).toBe(true);
    expect(hasAnyTier(ledgerRows.map((r) => ({ ...r, tier: null })))).toBe(false);
    expect(hasAnyTier([])).toBe(false);
  });

  it("keeps polling only while a payout is accepted or requested", () => {
    expect(hasInFlight(ledgerRows)).toBe(true);
    expect(hasInFlight(ledgerRows.filter((r) => r.status === "SUCCEEDED"))).toBe(false);
    expect(hasInFlight([])).toBe(false);
  });

  it("filters by status, with ALL returning every row", () => {
    expect(filterByStatus(ledgerRows, "ALL")).toHaveLength(ledgerRows.length);
    expect(filterByStatus(ledgerRows, "FAILED").map((r) => r.claim_ref)).toEqual(["RC-2a3b4c5d"]);
  });

  it("sorts newest update first without mutating the input", () => {
    const before = ledgerRows.map((r) => r.payout_id);
    const sorted = sortByUpdatedDesc(ledgerRows);
    expect(sorted[0].updated_at).toBe("2026-11-04T03:02:41Z");
    expect(sorted.at(-1)?.updated_at).toBe("2026-11-03T08:41:22Z");
    expect(ledgerRows.map((r) => r.payout_id)).toEqual(before);
  });

  it("summarizes totals, in-flight and failed payouts", () => {
    expect(summarize(ledgerRows)).toEqual({ total: 4, inFlight: 1, failed: 1 });
  });

  it("formats the update time as day, month and 24h time", () => {
    expect(formatUpdated("2026-11-04T02:14:14Z", "UTC")).toMatch(/4 Nov.*02:14/);
  });
});
