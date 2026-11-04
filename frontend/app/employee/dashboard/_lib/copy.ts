// Copy builders for the dashboard's fast-track card and overpayment notice.
// Strings follow DETAIL-PLAN §13.4. Kept pure so the wording is unit-tested.

import { formatClaimRef, formatMoney } from "@/lib/format";
import type { Recovery, TrustInfo, TrustTier } from "@/lib/api/reclaim-pay-types";

const TIER_LABEL: Record<TrustTier, string> = { NEW: "New", STANDARD: "Standard", TRUSTED: "Trusted" };

export function tierLabel(tier: TrustTier): string {
  return TIER_LABEL[tier];
}

/** "MYR 100" for whole limits, "MYR 87.50" otherwise. */
export function formatLimit(currency: string, amount: number): string {
  return Number.isInteger(amount) ? `${currency} ${amount}` : formatMoney(currency, amount);
}

export function isTopTier(info: TrustInfo): boolean {
  return info.next_tier === null || info.claims_to_next_tier === null;
}

/** "Instant payouts up to MYR 100 · 2 more approved claims to reach MYR 200" */
export function trustLine(info: TrustInfo): string {
  const currency = info.currency ?? "MYR";
  const limit = `Instant payouts up to ${formatLimit(currency, info.auto_limit)}`;
  if (isTopTier(info) || !info.next_tier) return `${limit} · This is the highest level.`;

  const n = Math.max(0, info.claims_to_next_tier ?? 0);
  const claims = n === 1 ? "1 more approved claim" : `${n} more approved claims`;
  const target = info.next_limit ? formatLimit(currency, info.next_limit) : tierLabel(info.next_tier);
  return `${limit} · ${claims} to reach ${target}`;
}

/** A recent correction keeps the employee at New. Shown instead of the progress line. */
export function trustLimitedLine(info: TrustInfo, timeZone?: string): string | null {
  if (info.trust_tier !== "NEW" || info.reasons.length === 0) return null;
  const base = "Instant payouts are limited after a recent correction.";
  if (!info.limited_until) return base;
  return `${base} They return to normal on ${formatDay(info.limited_until, timeZone)}.`;
}

/** Share of the way to the next tier, 0 to 1. */
export function trustProgress(info: TrustInfo): number {
  if (isTopTier(info)) return 1;
  const left = Math.max(0, info.claims_to_next_tier ?? 0);
  const total = info.paid_claims + left;
  return total === 0 ? 0 : Math.min(1, info.paid_claims / total);
}

// ─── Dates ───────────────────────────────────────────────────────────────────

function parts(iso: string, timeZone: string | undefined, opts: Intl.DateTimeFormatOptions) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { ...opts, timeZone }).formatToParts(new Date(iso))) {
    out[p.type] = p.value;
  }
  return out;
}

/** "8 Nov" */
export function formatDay(iso: string, timeZone?: string): string {
  const p = parts(iso, timeZone, { day: "numeric", month: "short" });
  return `${p.day} ${p.month}`;
}

/** "8 Nov, 6:00 pm" */
export function formatDeadline(iso: string, timeZone?: string): string {
  const p = parts(iso, timeZone, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${(p.dayPeriod ?? "").toLowerCase()}`.trim();
}

// ─── Overpayment notice ──────────────────────────────────────────────────────

export function isDisputeOpen(rec: Recovery, now: Date = new Date()): boolean {
  return new Date(rec.dispute_until).getTime() > now.getTime();
}

/** "We paid MYR 30.00 more than approved on claim RC-1A2B3C4D." */
export function noticeLine(rec: Recovery): string {
  return `We paid ${formatMoney(rec.currency, rec.amount)} more than approved on claim ${formatClaimRef(rec.reim_id)}.`;
}

export function deadlineLine(rec: Recovery, now: Date = new Date(), timeZone?: string): string {
  const when = formatDeadline(rec.dispute_until, timeZone);
  return isDisputeOpen(rec, now) ? `You can dispute until ${when}.` : `The dispute window closed on ${when}.`;
}

export const AFTER_WINDOW_LINE =
  "After HR reviews it, the amount comes off your next claim. If no claim covers it, you'll get a PayPal invoice instead.";

export const DISPUTED_LINE = "Disputed · HR will review";
