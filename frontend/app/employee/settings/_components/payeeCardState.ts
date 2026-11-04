import type { PayeeStatus } from "@/lib/api/reclaim-pay-types";

export type PayeeCardState = "notLinked" | "verified" | "coolDown" | "unverified";

/** Which Connect PayPal card to show. A cool-down that has already ended counts as no cool-down. */
export function payeeCardState(status: PayeeStatus, now: Date): PayeeCardState {
  if (!status.linked) return "notLinked";
  if (status.cooldown_until && new Date(status.cooldown_until).getTime() > now.getTime()) return "coolDown";
  if (!status.verified) return "unverified";
  return "verified";
}

/** When this session may next change the PayPal link, or null if it isn't paused. Separate from the auto-pay cool-down. */
export function linkChangesPausedUntil(status: PayeeStatus, now: Date): string | null {
  const until = status.link_changes_paused_until;
  return until && new Date(until).getTime() > now.getTime() ? until : null;
}
