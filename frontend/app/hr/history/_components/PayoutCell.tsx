import { Banknote, Loader2, Link2Off, AlertCircle, CircleDashed, Minus } from "lucide-react";
import type { PayoutState } from "@/lib/actions/hr";

type Display = { label: string; reason?: string; className: string; Icon: typeof Banknote };

export function payoutDisplay(state: PayoutState | null): Display {
  switch (state?.kind) {
    case "paid":
      return { label: "Paid", className: "text-emerald-700", Icon: Banknote };
    case "sending":
      return { label: "Sending", reason: "PayPal is processing it", className: "text-primary", Icon: Loader2 };
    case "waiting_link":
      return { label: "Waiting for PayPal link", reason: "Employee has not connected PayPal", className: "text-amber-800", Icon: Link2Off };
    case "failed":
      return {
        label: "Failed",
        reason: state.reason ? `${state.reason}. Retry from Payouts` : "Retry from Payouts",
        className: "text-red-700",
        Icon: AlertCircle,
      };
    case "not_sent":
      return { label: "Not sent yet", reason: "Approved, payout not started", className: "text-on-surface-variant", Icon: CircleDashed };
    default:
      return { label: "No payout", reason: "Claim was rejected", className: "text-on-surface-variant", Icon: Minus };
  }
}

/** Payout status with the reason under it, so HR can see why money has not moved. */
export default function PayoutCell({ state }: { state: PayoutState | null }) {
  const { label, reason, className, Icon } = payoutDisplay(state);
  return (
    <div className="min-w-0">
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${className}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className="line-clamp-2">{label}</span>
      </p>
      {reason && <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">{reason}</p>}
    </div>
  );
}
