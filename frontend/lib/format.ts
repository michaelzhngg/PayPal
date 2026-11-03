// Display formats shared by the employee and HR screens.
export { formatMoney } from "@/lib/api/reclaim-pay-types";

/** "6de03699-9ebe-..." -> "RC-6DE03699". Matches the backend ledger's claim_ref. */
export function formatClaimRef(reimId: string): string {
  return `RC-${reimId.replace(/^RC-/i, "").slice(0, 8).toUpperCase()}`;
}
