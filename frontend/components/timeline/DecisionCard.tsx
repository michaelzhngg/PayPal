import type { AutonomyDecision, AutonomyTier } from "@/lib/api/reclaim-pay-types";
import { employeeTierCopy, tierLabel } from "./copy";

// Auto-pay is the only outcome that means money is moving now, so it alone takes the brand color.
const PILL: Record<AutonomyTier, string> = {
  AUTO_PAY: "bg-primary/10 text-primary",
  HR_QUICK: "bg-surface-container-high text-on-surface",
  HR_REVIEW: "bg-surface-container-high text-on-surface",
  DUAL_REVIEW: "bg-surface-container-high text-on-surface",
};

interface DecisionCardProps {
  decision: AutonomyDecision;
  /** Amount as the backend formats it, e.g. "MYR 48.00". */
  amount: string;
  audience: "employee" | "hr";
  /** Shown above the outcome when a submission produced more than one claim. */
  caption?: string;
}

export default function DecisionCard({ decision, amount, audience, caption }: DecisionCardProps) {
  // Employees never see DUAL_REVIEW as its own pill: that alone would hint a high-risk check fired.
  const pillTier: AutonomyTier = audience === "employee" && decision.tier === "DUAL_REVIEW" ? "HR_REVIEW" : decision.tier;

  return (
    <div className="w-full text-left rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
      {caption && <p className="font-body text-xs text-on-surface-variant mb-2">{caption}</p>}
      <span className={`inline-block rounded-md px-2 py-0.5 font-body text-xs font-semibold ${PILL[pillTier]}`}>
        {tierLabel(decision.tier, audience)}
      </span>
      {audience === "employee" ? (
        <p className="mt-2 font-body text-sm text-on-surface">{employeeTierCopy(decision.tier, amount)}</p>
      ) : (
        <>
          <p className="mt-2 font-body text-sm text-on-surface">{decision.explanation}</p>
          <p className="mt-1 font-body text-xs text-on-surface-variant">
            Risk {decision.risk_score}/100 · {amount}
            {decision.hard_stops.length > 0 && ` · ${decision.hard_stops.length} hard stop${decision.hard_stops.length === 1 ? "" : "s"}`}
          </p>
        </>
      )}
    </div>
  );
}
