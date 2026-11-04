import type { AiStatus } from "@/lib/api/types";
import { AlertTriangle, Clock, CheckCircle2, HelpCircle, Zap, XCircle } from "lucide-react";
import { JSX } from "react";

export const STATUS_ICON: Record<AiStatus, JSX.Element> = {
  "Policy Flagged": <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} />,
  "Awaiting Review": <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />,
  "Passed AI Review": <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />,
  "Low Confidence": <HelpCircle className="w-3.5 h-3.5" strokeWidth={2.5} />,
  "Auto-Approved": <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />,
  "Auto-Rejected": <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} />,
};

export const STATUS_STYLE: Record<AiStatus, string> = {
  "Policy Flagged": "bg-danger/10 text-danger",
  "Awaiting Review": "bg-warning-soft text-warning",
  "Passed AI Review": "bg-success-soft text-success",
  "Low Confidence": "bg-accent/10 text-accent",
  "Auto-Approved": "bg-success-soft text-success",
  "Auto-Rejected": "bg-danger-soft text-danger",
};

export function StatusBadge({ status }: { status: AiStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[status]}`}
    >
      {STATUS_ICON[status]}
      {status}
    </span>
  );
}
