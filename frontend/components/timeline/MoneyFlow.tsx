"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, Loader2, XCircle } from "lucide-react";
import { getPayeeStatus } from "@/lib/actions/paypal";
import { usePayoutStatus } from "@/lib/hooks/usePayoutStatus";
import { formatMoney, type PayeeStatus } from "@/lib/api/reclaim-pay-types";
import { FLOW_NODES, displayTier, flowState, type NodeState } from "./flow";

interface MoneyFlowProps {
  reimId: string;
  /** Backend reimbursement status, e.g. APPROVED or PAID. */
  claimStatus: string;
}

const NODE_STYLE: Record<NodeState, { icon: typeof Circle; className: string }> = {
  done: { icon: CheckCircle2, className: "text-primary" },
  active: { icon: Loader2, className: "text-primary animate-spin" },
  waiting: { icon: Clock, className: "text-amber-700" },
  error: { icon: XCircle, className: "text-error" },
  pending: { icon: Circle, className: "text-outline-variant" },
};

function nodeCaption(index: number, state: NodeState, amount: string | null): string {
  if (index === 2 && state === "waiting") return "With HR";
  if (index === 3) {
    if (state === "active") return "Sending";
    if (state === "done") return "Sent";
    if (state === "error") return "Didn't go through";
  }
  if (index === 4 && state === "done") return amount ? `${amount} in your PayPal` : "In your PayPal";
  if (state === "done") return "Done";
  return "Not yet";
}

export default function MoneyFlow({ reimId, claimStatus }: MoneyFlowProps) {
  const { payout, timedOut, loaded } = usePayoutStatus(reimId);
  const [payee, setPayee] = useState<PayeeStatus | null>(null);

  useEffect(() => {
    getPayeeStatus().then(setPayee);
  }, []);

  const states = flowState(displayTier(claimStatus, payout !== null), payout?.status ?? null);
  const amount = payout ? formatMoney(payout.currency, payout.amount) : null;
  const paypalLabel = payee?.email_masked ? `your PayPal account (${payee.email_masked})` : "your PayPal account";

  let summary: ReactNode;
  if (!loaded) {
    summary = "Checking payment status…";
  } else if (states[2] === "waiting") {
    summary = "Sent to HR for review.";
  } else if (!payout) {
    summary =
      payee && !payee.linked ? (
        <>
          Connect PayPal to receive this payment.{" "}
          <Link href="/employee/settings" className="font-semibold text-primary underline underline-offset-2">
            Go to settings
          </Link>
        </>
      ) : (
        "We haven't sent this payment yet."
      );
  } else if (states[4] === "done") {
    summary = `${amount} arrived in ${paypalLabel}.`;
  } else if (states[3] === "error") {
    summary = "This payment didn't go through. HR can send it again.";
  } else if (timedOut) {
    summary = "PayPal is still processing this payment. Check back later.";
  } else {
    summary = `Sending ${amount} to ${paypalLabel}.`;
  }

  return (
    <section aria-labelledby={`money-flow-${reimId}`} className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
      <h4 id={`money-flow-${reimId}`} className="font-headline font-semibold text-sm text-on-surface mb-3">
        Payment
      </h4>

      <ol className="flex flex-col gap-3 sm:flex-row sm:gap-2">
        {FLOW_NODES.map((label, i) => {
          const { icon: Icon, className } = NODE_STYLE[states[i]];
          return (
            <li key={label} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5">
              <Icon className={`w-5 h-5 shrink-0 ${className}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-body text-xs font-semibold text-on-surface">{label}</p>
                <p className="font-body text-xs text-on-surface-variant">{nodeCaption(i, states[i], amount)}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" className="mt-4 font-body text-sm text-on-surface">
        {summary}
      </p>
    </section>
  );
}
