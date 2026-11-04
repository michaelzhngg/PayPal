import { describe, expect, it } from "vitest";
import type { PayoutInfo, ReimbursementRaw } from "@/lib/api/types";
import { buildCalendarEvents, latestEventDay, reimIdFromEventId } from "./events";

const REIM_ID = "6de03699-9ebe-4a11-8c55-000000000001";

function row(overrides: Partial<ReimbursementRaw> = {}): ReimbursementRaw {
  return {
    reim_id: REIM_ID,
    created_at: "2026-11-02T04:00:00+00:00",
    currency: "MYR",
    total_claimed_amount: 48,
    tier: "HR_QUICK",
    payout: null,
    ...overrides,
  } as ReimbursementRaw;
}

function payout(overrides: Partial<PayoutInfo> = {}): PayoutInfo {
  return {
    payout_id: "p1",
    amount: 48,
    currency: "MYR",
    status: "SUCCEEDED",
    channel_code: "PAYPAL",
    created_at: "2026-11-03T04:00:00+00:00",
    updated_at: "2026-11-03T04:05:00+00:00",
    ...overrides,
  };
}

describe("buildCalendarEvents", () => {
  it("names the submitted event by claim ref", () => {
    const [event] = buildCalendarEvents([row()]);
    expect(event.name).toBe("Submitted RC-6DE03699");
    expect(event.reimId).toBe(REIM_ID);
  });

  it("gives auto-pay its own tone and every other tier the same one", () => {
    const tone = (tier: unknown) => buildCalendarEvents([row({ tier } as Partial<ReimbursementRaw>)])[0].cls;
    expect(tone("AUTO_PAY")).toContain("claim-event-auto");
    const hr = tone("HR_REVIEW");
    expect(hr).toContain("claim-event-hr");
    expect(tone("HR_QUICK")).toBe(hr);
    expect(tone("DUAL_REVIEW")).toBe(hr);
    expect(tone(null)).toBe(hr);
  });

  it("adds a paid event for a settled payout, on the payout's day", () => {
    const events = buildCalendarEvents([row({ payout: payout() })]);
    expect(events).toHaveLength(2);
    expect(events[1].name).toBe("Paid MYR 48.00");
    expect(events[1].cls).toContain("claim-event-paid");
    expect(events[1].startDate).toEqual(localMidnight("2026-11-03T04:05:00+00:00"));
  });

  it("takes the paid amount from the payout, not the claim", () => {
    const events = buildCalendarEvents([row({ total_claimed_amount: 90, payout: payout({ amount: 1234.5 }) })]);
    expect(events[1].name).toBe("Paid MYR 1,234.50");
  });

  it.each(["ACCEPTED", "REQUESTED", "FAILED", "CANCELLED", "REVERSED"] as const)("adds no paid event for a %s payout", (status) => {
    expect(buildCalendarEvents([row({ payout: payout({ status }) })])).toHaveLength(1);
  });

  it("skips timestamps it cannot read", () => {
    expect(buildCalendarEvents([row({ created_at: null })])).toEqual([]);
    expect(buildCalendarEvents([row({ created_at: "not a date" })])).toEqual([]);
    expect(buildCalendarEvents([row({ payout: payout({ updated_at: null }) })])).toHaveLength(1);
  });

  it("spans one whole local day", () => {
    const [event] = buildCalendarEvents([row()]);
    expect(event.allDay).toBe(true);
    expect(event.startDate.getHours()).toBe(0);
    expect(event.endDate.getTime() - event.startDate.getTime()).toBeGreaterThanOrEqual(23 * 3600 * 1000);
  });

  it("carries nothing from the row beyond what it displays", () => {
    const leaky = row({ risk_score: 55, summary: "AI verdict", ai_reasoning: { signals: ["DUPLICATE_RECEIPT"] }, tier: "DUAL_REVIEW" } as Partial<ReimbursementRaw>);
    const text = JSON.stringify(buildCalendarEvents([leaky]));
    expect(text).not.toMatch(/risk|signal|verdict|DUPLICATE|DUAL_REVIEW/i);
  });
});

describe("reimIdFromEventId", () => {
  it("recovers the claim id from both event kinds", () => {
    const events = buildCalendarEvents([row({ payout: payout() })]);
    expect(events.map((e) => reimIdFromEventId(e.id))).toEqual([REIM_ID, REIM_ID]);
  });
});

describe("latestEventDay", () => {
  it("returns the newest day, or null with no events", () => {
    expect(latestEventDay([])).toBeNull();
    const events = buildCalendarEvents([row({ created_at: "2026-09-15T04:00:00+00:00" }), row({ reim_id: "b", created_at: "2026-10-20T04:00:00+00:00" })]);
    expect(latestEventDay(events)).toEqual(localMidnight("2026-10-20T04:00:00+00:00"));
  });
});

function localMidnight(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
