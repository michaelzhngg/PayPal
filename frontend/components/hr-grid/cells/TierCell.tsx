import type { AutonomyTier } from "@/lib/api/reclaim-pay-types";
import { TIER_LABEL } from "../rows";

// The tier is the sentence "how much of a person does this claim need", so the
// pill tone rises with human effort. Text always carries the meaning; tone only supports it.
const TIER_TONE: Record<AutonomyTier, string> = {
  AUTO_PAY: "bg-emerald-50 text-emerald-800 border-emerald-200",
  HR_QUICK: "bg-surface-container text-on-surface border-outline-variant/40",
  HR_REVIEW: "bg-amber-50 text-amber-900 border-amber-200",
  DUAL_REVIEW: "bg-red-50 text-red-800 border-red-200",
};

export function TierPill({ tier }: { tier: AutonomyTier }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md border text-xs font-semibold ${TIER_TONE[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
