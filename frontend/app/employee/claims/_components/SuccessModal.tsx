"use client";

import { CheckCircle2, ChevronDown, LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AgentTimeline from "@/components/timeline/AgentTimeline";
import DecisionCard from "@/components/timeline/DecisionCard";
import MoneyFlow from "@/components/timeline/MoneyFlow";
import { formatMoney, type AutonomyDecision, type TimelineStepState } from "@/lib/api/reclaim-pay-types";
import type { AnalyzeResponse } from "@/lib/api/types";

export type SuccessType = "claim" | "hr";

interface SuccessModalProps {
  type: SuccessType;
  onSubmitAnother: () => void;
  /** Reimbursements from the analysis `complete` event. One submission can create two. */
  reimbursements?: AnalyzeResponse[];
  /** Timeline rows already filtered for the employee. */
  timeline?: TimelineStepState[];
}

function decisionOf(r: AnalyzeResponse): AutonomyDecision | null {
  const a = r.autonomy;
  return a && typeof a === "object" && "tier" in a ? (a as AutonomyDecision) : null;
}

export function SuccessModal({ type, onSubmitAnother, reimbursements = [], timeline = [] }: SuccessModalProps) {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    dialogRef.current?.focus();
    return () => clearTimeout(t);
  }, []);

  const isHr = type === "hr";
  const claims = isHr ? [] : reimbursements;
  const hasDecision = claims.some(r => decisionOf(r) !== null);
  const multiple = claims.length > 1;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/30 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
        tabIndex={-1}
        className={`w-full ${claims.length > 0 ? "max-w-lg" : "max-w-md"} max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-container-lowest rounded-3xl shadow-[0_32px_80px_-16px_rgba(44,47,49,0.25)] border border-outline-variant/15 flex flex-col items-center text-center p-6 sm:p-10 outline-none transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"
        }`}
      >
        {/* Success animation ring */}
        <div className="relative w-20 h-20 mb-7 shrink-0">
          <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" strokeWidth={1.75} />
          </div>
        </div>

        {/* Title */}
        <h2 id="success-title" className="font-headline text-2xl font-bold text-on-surface tracking-tight mb-3">
          {isHr ? "Sent to HR!" : "Claim Submitted!"}
        </h2>

        {hasDecision ? (
          <div className="w-full flex flex-col gap-3 mb-6">
            {claims.map((r, i) => {
              const decision = decisionOf(r);
              const amount = formatMoney(r.currency, r.total_approved_amount ?? r.total_claimed_amount);
              const caption = multiple ? `Claim ${i + 1} of ${claims.length} · ${r.main_category}` : undefined;
              return (
                <div key={r.reim_id} className="flex flex-col gap-3">
                  {decision ? (
                    <DecisionCard decision={decision} amount={amount} audience="employee" caption={caption} />
                  ) : (
                    caption && <p className="text-left font-body text-xs text-on-surface-variant">{caption}</p>
                  )}
                  <div className="text-left">
                    <MoneyFlow reimId={r.reim_id} claimStatus={r.status} tier={decision?.tier} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* Body */}
            <p className="text-sm text-on-surface-variant font-body leading-relaxed max-w-xs mb-2">
              {isHr
                ? "Your claim and documents have been forwarded to the HR team for manual review."
                : "Your expense claim has been submitted for approval."}
            </p>
            <p className="text-sm text-on-surface-variant font-body leading-relaxed max-w-xs mb-8">
              {isHr
                ? "You'll be notified once they complete the verification."
                : "You'll be notified once it's reviewed by your manager."}
            </p>

            {/* Policy check note (only for normal submission) */}
            {!isHr && (
              <div className="bg-primary/5 border border-primary/10 rounded-2xl px-4 py-3 mb-6 w-full">
                <p className="text-xs text-primary font-body leading-relaxed">
                  Policy compliance check is running in the background. No action needed from you.
                </p>
              </div>
            )}

            {claims.length > 0 && (
              <div className="w-full flex flex-col gap-3 mb-6 text-left">
                {claims.map((r, i) => (
                  <div key={r.reim_id} className="flex flex-col gap-2">
                    {multiple && (
                      <p className="font-body text-xs text-on-surface-variant">
                        Claim {i + 1} of {claims.length} · {r.main_category}
                      </p>
                    )}
                    <MoneyFlow reimId={r.reim_id} claimStatus={r.status} tier={r.tier ?? undefined} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* The checks stay one click away: the outcome is the focus, the trail is there for anyone who asks. */}
        {timeline.length > 0 && (
          <details className="group w-full mb-8 rounded-2xl border border-outline-variant/15 text-left">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 font-body text-sm font-semibold text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              See what the agent checked
              <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-4 pb-4">
              <AgentTimeline steps={timeline} title="Checks on this claim" />
            </div>
          </details>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={onSubmitAnother}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm font-body border border-outline-variant/30 text-on-surface bg-surface-container hover:bg-surface-container-high active:scale-95 transition-all duration-200"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Submit Another
          </button>
          <Link
            href="/employee/dashboard"
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm font-body bg-primary text-on-primary shadow-[0_4px_16px_rgba(70,71,211,0.3)] hover:bg-primary-dim hover:shadow-[0_6px_24px_rgba(70,71,211,0.4)] hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            <LayoutDashboard className="w-4 h-4" strokeWidth={2} />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
