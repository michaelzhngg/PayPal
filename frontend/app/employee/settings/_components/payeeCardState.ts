import type { PayeeStatus } from "@/lib/api/reclaim-pay-types";

export type PayeeCardState = "notLinked" | "verified" | "coolDown" | "unverified";

/** Which Connect PayPal card to show. A cool-down that has already ended counts as no cool-down. */
export function payeeCardState(status: PayeeStatus, now: Date): PayeeCardState {
  if (!status.linked) return "notLinked";
  if (status.cooldown_until && new Date(status.cooldown_until).getTime() > now.getTime()) return "coolDown";
  if (!status.verified) return "unverified";
  return "verified";
}
