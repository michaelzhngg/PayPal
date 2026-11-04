"use client";

import { CheckCircle2, LayoutDashboard, ShieldX, AlertTriangle, UserCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export type HRDecision = "approve_full" | "approve_adjusted" | "reject" | "confirm" | "flag" | null;

/** True when the backend recorded the first of two approvals on a two-person (DUAL_REVIEW) claim. */
export function isAwaitingSecondApproval(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { awaiting_second_approval?: unknown }).awaiting_second_approval === true;
}

export function SuccessModal({
  decision,
  id,
  awaitingSecondApproval = false,
}: {
  decision: HRDecision;
  id: string;
  /** First approval of two: nothing is paid yet, so the modal must not say the claim is done. */
  awaitingSecondApproval?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  let title = "Review Submitted!";
  let subtitle = "The claim has been processed successfully.";
  
  if (decision === "approve_full") {
    subtitle = `Claim bundle ${id} has been fully approved.`;
  } else if (decision === "approve_adjusted") {
    subtitle = `Claim bundle ${id} has been approved with HR adjustments.`;
  } else if (decision === "reject") {
    title = "Claim Rejected";
    subtitle = `Claim bundle ${id} has been rejected.`;
  } else if (decision === "confirm") {
    title = "Approval Finalised!";
    subtitle = `Claim bundle ${id} has been fully finalised and the employee has been notified.`;
  } else if (decision === "flag") {
    title = "Claim Flagged";
    subtitle = `Claim bundle ${id} has been flagged for re-review.`;
  }

  if (awaitingSecondApproval) {
    title = "Approval recorded";
    subtitle = "A second HR member must approve before the payout is sent.";
  }

  const isError = decision === "reject";
  const isWarning = decision === "flag";

  let Icon = awaitingSecondApproval ? UserCheck : CheckCircle2;
  let colorTheme = "green";
  if (isError) {
    Icon = ShieldX;
    colorTheme = "error";
  } else if (isWarning) {
    Icon = AlertTriangle;
    colorTheme = "amber";
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/30" : "bg-transparent"
      }`}
    >
      <div
        className={`w-full max-w-md bg-surface rounded-3xl border border-line/15 flex flex-col items-center text-center p-10 transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
        }`}
      >
        <div className="relative w-20 h-20 mb-7">
          <div className={`absolute inset-0 rounded-full animate-ping ${
            colorTheme === "error" ? "bg-danger/10" : colorTheme === "amber" ? "bg-warning/10" : "bg-success/10"
          }`} />
          <div className={`relative w-20 h-20 rounded-full border flex items-center justify-center ${
            colorTheme === "error" ? "bg-danger/15 border-danger/30" : colorTheme === "amber" ? "bg-warning/15 border-warning/30" : "bg-success/15 border-success/30"
          }`}>
            <Icon className={`w-10 h-10 ${
              colorTheme === "error" ? "text-danger" : colorTheme === "amber" ? "text-warning" : "text-success"
            }`} strokeWidth={1.75} />
          </div>
        </div>

        <h2 className="font-display text-2xl font-bold text-ink mb-3">
          {title}
        </h2>

        <p className="text-sm text-ink-muted font-body leading-relaxed max-w-xs mb-8">
          {subtitle}
        </p>

        <div className="w-full">
          <Link
            href="/hr/dashboard"
            className="flex items-center justify-center gap-2 px-5 py-3 w-full rounded-xl font-semibold text-sm font-body bg-accent text-on-accent hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            <LayoutDashboard className="w-4 h-4" strokeWidth={2} />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
