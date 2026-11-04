"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Download,
  ExternalLink,
  AlertTriangle,
  Info,
  CheckCheck,
  MinusCircle,
  XCircle,
  Building2,
  MapPin,
  Calendar as CalendarIcon,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { HistoryClaim, LineItem, ClaimStatus } from "./historyData";
import MoneyFlow from "@/components/timeline/MoneyFlow";
import { formatClaimRef, formatMoney } from "@/lib/format";

// ─── Prop types ───────────────────────────────────────────────────────────────

interface ClaimSidebarProps {
  claim: HistoryClaim | null;
  onClose: () => void;
  isLoading?: boolean;
}

// ─── Currency formatter (MYR) ─────────────────────────────────────────────────

function fmt(v: number) {
  return formatMoney("MYR", v);
}

// ─── Status Cascading Logic ───────────────────────────────────────────────────
// Derives effective parent status from the actual lineItems totals.
// Pending always stays Pending.

function deriveStatus(claim: HistoryClaim): ClaimStatus {
  if (claim.status === "Pending") return "Pending";
  const items      = claim.lineItems ?? [];
  const totalReq   = items.reduce((s, i) => s + i.requested, 0);
  const totalApp   = items.reduce((s, i) => s + i.approved,  0);
  if (totalApp === 0)       return "Rejected";
  if (totalApp >= totalReq) return claim.status === "Paid" ? "Paid" : "Approved";
  return "Partially Approved";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClaimStatus }) {
  const styles: Record<ClaimStatus, string> = {
    Pending:              "bg-accent-soft/50 text-accent-hover",
    Approved:             "bg-accent/10 text-accent",
    "Partially Approved": "bg-warning/10 text-warning",
    Paid:                 "bg-accent/10 text-accent",
    Rejected:             "bg-danger/10 text-danger",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Per-Row Mini Status Badge ────────────────────────────────────────────────

function LineStatusBadge({ s }: { s: LineItem["lineStatus"] }) {
  const cfg = {
    Approved: { cls: "bg-accent/10 text-accent",     Icon: CheckCheck  },
    Adjusted: { cls: "bg-warning/10 text-warning", Icon: MinusCircle },
    Rejected: { cls: "bg-danger/10 text-danger",         Icon: XCircle     },
    Pending:  { cls: "bg-accent-soft/50 text-accent-hover", Icon: Clock },
  }[s];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${cfg.cls}`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {s}
    </span>
  );
}

// ─── HR Note Banner ───────────────────────────────────────────────────────────

// Shows only notes HR wrote for the employee. AI text never reaches this view.
function HRNoteBanner({ note }: { note: string }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-xl bg-accent/5 border border-accent/15">
      <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
      <div>
        <p className="font-display font-semibold text-xs text-accent mb-0.5 uppercase tracking-wider">
          Note from HR
        </p>
        <p className="font-body text-sm text-ink-muted leading-relaxed">{note}</p>
      </div>
    </div>
  );
}

// ─── Line Item Row ────────────────────────────────────────────────────────────
// masterRejected=true: override all child rows to show Rejected + RM 0.00
// regardless of individual data (Cascading Rejection rule).

function LineItemRow({
  item,
  masterRejected,
  masterPending,
}: {
  item: LineItem;
  masterRejected: boolean;
  masterPending: boolean;
}) {
  const effectiveStatus: LineItem["lineStatus"] = masterPending ? "Pending" : masterRejected ? "Rejected" : item.lineStatus;
  const effectiveApproved = (masterPending || masterRejected) ? 0 : item.approved;

  const isRejected = effectiveStatus === "Rejected";
  const isAdjusted = effectiveStatus === "Adjusted";
  const isPending  = effectiveStatus === "Pending";
  const isDeducted = isRejected || isAdjusted;

  const rowBg      = isRejected ? "bg-danger/5 border-danger/15"
                   : isAdjusted ? "bg-warning/5 border-warning/15"
                   : isPending  ? "bg-accent-soft/20 border-line/10 opacity-80"
                   : "bg-surface border-line/10";

  const amountColor = isRejected ? "text-danger"
                    : isAdjusted ? "text-warning"
                    : isPending  ? "text-ink-muted font-medium"
                    : "text-accent";

  return (
    <div className={`rounded-xl border p-3 ${rowBg}`}>
      {/* Row header: category + receipt ref tag + mini badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display font-semibold text-sm text-ink">
              {item.category}
            </p>
            <span className="font-mono text-[10px] text-ink-muted/60 bg-surface-muted px-1.5 py-0.5 rounded">
              {item.receiptRef}
            </span>
          </div>
        </div>
        <LineStatusBadge s={effectiveStatus} />
      </div>

      {/* Requested vs Approved amounts */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-ink-muted">
          {isDeducted ? (
            <>Requested: <del className="opacity-60">{fmt(item.requested)}</del></>
          ) : (
            isPending ? "Requested:" : <span className="opacity-70">{fmt(item.requested)}</span>
          )}
        </span>
        <span className={`font-display font-bold text-sm tabular-nums ${amountColor}`}>
          {isPending ? fmt(item.requested) : fmt(effectiveApproved)}
        </span>
      </div>

      {/* Audit Note box — shown when there are deduction reasons */}
      {item.adjustments.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-warning/8 border border-warning/20 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-warning mb-1.5">
            Audit Note
          </p>
          <ul className="space-y-1">
            {item.adjustments.map((adj, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-ink-muted">
                <AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                <span>
                  <span className="font-mono text-[10px] text-warning/80 uppercase mr-1">
                    [{adj.code}]
                  </span>
                  {adj.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── A4 HTML Claim Form Modal ─────────────────────────────────────────────────

function ClaimFormModal({
  claim,
  effectiveStatus,
  totalRequested,
  totalApproved,
  masterRejected,
  masterPending,
  onClose,
}: {
  claim: HistoryClaim;
  effectiveStatus: ClaimStatus;
  totalRequested: number;
  totalApproved: number;
  masterRejected: boolean;
  masterPending: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalDeducted = totalRequested - totalApproved;

  const statusChip = {
    Approved:             "bg-success-soft text-success",
    "Partially Approved": "bg-warning-soft text-warning",
    Rejected:             "bg-danger-soft text-danger",
    Paid:                 "bg-success-soft text-success",
    Pending:              "bg-surface-muted text-ink-muted",
  }[effectiveStatus];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black overflow-auto"
      onClick={onClose}
    >
      <style>{`
        .a4-modal-zoom { zoom: 1; }
        @media (max-width: 850px) {
          .a4-modal-zoom { zoom: calc((100vw - 32px) / 794); }
        }
      `}</style>

      {/* High-visibility fixed close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 md:top-8 md:right-8 z-[200] p-3 bg-ink/60 hover:bg-ink/90 text-white rounded-full shadow-overlay transition-all active:scale-95 border border-white/10"
        aria-label="Close preview"
      >
        <X className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Scrollable canvas region */}
      <div className="min-h-full w-full flex justify-center p-4 md:p-12 pb-24 touch-pan-x touch-pan-y">
        {/* A4 Physical Paper */}
        <div
          className="a4-modal-zoom bg-white rounded-sm shrink-0 border border-line/50"
          style={{ width: "794px", minHeight: "1123px", fontFamily: "sans-serif" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-12 md:p-16 text-ink" style={{ fontSize: "12px" }}>
            {/* Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-ink pb-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                  <span className="text-white font-bold text-xs">R</span>
                </div>
                <span className="font-bold text-xl text-ink tracking-tight">Reclaim Pay</span>
              </div>
              <p className="text-ink-muted text-xs">Automated Reimbursement Management System</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-base text-ink">EXPENSE CLAIM FORM</p>
              <p className="text-ink-muted font-mono text-xs">{formatClaimRef(claim.id)}</p>
              <p className="text-ink-muted text-xs mt-1">Date: {claim.date}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${statusChip}`}>
                {effectiveStatus}
              </span>
            </div>
          </div>

          {/* Employee Details */}
          <section className="mb-8">
            <h3 className="font-bold text-xs text-ink-muted uppercase tracking-wider mb-3 border-b border-line pb-1">
              Employee Information
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {[
                ["Full Name",   claim.employee.name     || "—"],
                ...(claim.employee.id ? [["Employee ID", claim.employee.id]] : []),
                ["Department",  claim.employee.department || "—"],
                ["Position",    claim.employee.position || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">{label}:</span>
                  <span className="font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Claim Context */}
          <section className="mb-8">
            <h3 className="font-bold text-xs text-ink-muted uppercase tracking-wider mb-3 border-b border-line pb-1">
              Claim Context
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {claim.claimContext.purpose && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Purpose:</span>
                  <span className="font-semibold">{claim.claimContext.purpose}</span>
                </div>
              )}
              {claim.claimContext.destination && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Destination:</span>
                  <span className="font-semibold">{claim.claimContext.destination}</span>
                </div>
              )}
              {claim.claimContext.departurDate && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Departure:</span>
                  <span className="font-semibold">{claim.claimContext.departurDate}</span>
                </div>
              )}
              {claim.claimContext.arrivalDate && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Arrival:</span>
                  <span className="font-semibold">{claim.claimContext.arrivalDate}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-ink-muted w-28 shrink-0">Overseas:</span>
                <span className="font-semibold">{claim.claimContext.overseas ? "Yes" : "No"}</span>
              </div>
            </div>
          </section>

          {/* Line Items Table */}
          <section className="mb-8">
            <h3 className="font-bold text-xs text-ink-muted uppercase tracking-wider mb-3 border-b border-line pb-1">
              Expense Line Items ({claim.lineItems.length} Receipts)
            </h3>
            <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
              <thead>
                <tr className="bg-surface-muted text-ink-muted uppercase text-[10px] tracking-wider">
                  <th className="text-left py-2 px-3 border border-line font-semibold w-16">Ref</th>
                  <th className="text-left py-2 px-3 border border-line font-semibold">Category / Audit Notes</th>
                  <th className="text-right py-2 px-3 border border-line font-semibold w-28">Requested (MYR)</th>
                  <th className="text-right py-2 px-3 border border-line font-semibold w-28">Approved (MYR)</th>
                  <th className="text-center py-2 px-3 border border-line font-semibold w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {claim.lineItems.map((item, i) => {
                  const effStatus   = masterPending ? "Pending" : masterRejected ? "Rejected" : item.lineStatus;
                  const effApproved = (masterPending || masterRejected) ? 0 : item.approved;
                  return (
                    <tr key={i} className={
                      effStatus === "Rejected" ? "bg-danger-soft"
                    : effStatus === "Adjusted" ? "bg-warning-soft"
                    : effStatus === "Pending"  ? "bg-surface-muted"
                    : "bg-white"
                    }>
                      <td className="py-2 px-3 border border-line font-mono text-[10px] text-ink-muted">
                        {item.receiptRef}
                      </td>
                      <td className="py-2 px-3 border border-line">
                        {item.category}
                        {item.adjustments.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.adjustments.map((adj, j) => (
                              <div key={j} className="text-[10px] text-ink-muted flex gap-1">
                                <span className="text-ink-muted">↳</span>
                                <span>[{adj.code}] {adj.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 border border-line text-right tabular-nums">
                        {item.requested.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 border border-line text-right tabular-nums font-semibold">
                        {effApproved.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 border border-line text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          effStatus === "Approved" ? "bg-success-soft text-success"
                        : effStatus === "Adjusted" ? "bg-warning-soft text-warning"
                        : effStatus === "Pending"  ? "bg-surface-muted text-ink-muted"
                        : "bg-danger-soft text-danger"
                        }`}>
                          {effStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-muted font-bold">
                  <td colSpan={2} className="py-2 px-3 border border-line text-right text-ink">Total Requested</td>
                  <td className="py-2 px-3 border border-line text-right tabular-nums">{totalRequested.toFixed(2)}</td>
                  <td className="py-2 px-3 border border-line text-right tabular-nums text-ink">{totalApproved.toFixed(2)}</td>
                  <td className="py-2 px-3 border border-line" />
                </tr>
                {totalDeducted > 0 && (
                  <tr className="bg-danger-soft">
                    <td colSpan={2} className="py-2 px-3 border border-line text-right text-danger font-semibold">Total Deduction</td>
                    <td className="py-2 px-3 border border-line" />
                    <td className="py-2 px-3 border border-line text-right tabular-nums text-danger font-bold">({totalDeducted.toFixed(2)})</td>
                    <td className="py-2 px-3 border border-line" />
                  </tr>
                )}
                <tr className="bg-accent-soft">
                  <td colSpan={2} className="py-3 px-3 border border-line text-right text-accent font-bold uppercase tracking-wide">NET APPROVED</td>
                  <td className="py-3 px-3 border border-line" />
                  <td className="py-3 px-3 border border-line text-right tabular-nums text-accent font-bold text-base">{totalApproved.toFixed(2)}</td>
                  <td className="py-3 px-3 border border-line" />
                </tr>
              </tfoot>
            </table>
          </section>

          {/* HR Comments */}
          {claim.hrNote && (
            <section className="mb-8">
              <h3 className="font-bold text-xs text-ink-muted uppercase tracking-wider mb-2 border-b border-line pb-1">
                HR Comments
              </h3>
              <p className="text-ink leading-relaxed italic">&ldquo;{claim.hrNote}&rdquo;</p>
            </section>
          )}

          {/* Signature Block */}
          <div className="mt-12 grid grid-cols-2 gap-12 border-t border-line pt-6">
            {["Employee Signature", "HR Authorisation"].map((label) => (
              <div key={label}>
                <div className="h-12 border-b border-line-strong mb-2" />
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="text-xs text-ink-muted mt-0.5">Date: ___________</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-surface-muted flex justify-between text-ink-muted text-[10px]">
            <span>Generated by Reclaim Pay · {formatClaimRef(claim.id)}</span>
            <span>CONFIDENTIAL — Internal Use Only</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Main ClaimSidebar Component ──────────────────────────────────────────────

export default function ClaimSidebar({ claim, onClose, isLoading = false }: ClaimSidebarProps) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const [isVisible,     setIsVisible]     = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  useEffect(() => {
    if (claim) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      // Let the exit animation finish before unmounting
      document.body.style.overflow = "auto";
      const timer = setTimeout(() => {
        setIsVisible(false);
        setShowFormModal(false);
      }, 420);
      return () => clearTimeout(timer);
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [claim]);

  const openFormModal  = useCallback(() => setShowFormModal(true),  []);
  const closeFormModal = useCallback(() => setShowFormModal(false), []);

  // ── Derived values (cached) ─────────────────────────────────────────────────
  const effectiveStatus = useMemo(
    () => (claim ? deriveStatus(claim) : ("Pending" as ClaimStatus)),
    [claim]
  );
  const items = useMemo(() => claim?.lineItems ?? [], [claim]);
  const totalRequested = useMemo(() => items.reduce((s, i) => s + i.requested, 0), [items]);
  const totalApproved  = useMemo(() => {
    if (effectiveStatus === "Rejected") return 0;
    return items.reduce((s, i) => s + i.approved, 0);
  }, [items, effectiveStatus]);
  const totalDeducted  = totalRequested - totalApproved;

  const masterRejected = effectiveStatus === "Rejected";
  const isPending      = effectiveStatus === "Pending";
  const isPartial      = effectiveStatus === "Partially Approved";

  if (!claim && !isVisible) return null;

  return (
    <>
      {/* ── Overlay ── */}
      <div
        className={`fixed inset-0 bg-paper/40 z-60 transition-opacity duration-400 ${
          claim ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Drawer (max-w-2xl on desktop) ── */}
      <div
        style={{ transitionTimingFunction: claim ? "cubic-bezier(0.32,0.72,0,1)" : "cubic-bezier(0.4,0,1,1)" }}
        className={`fixed top-0 right-0 h-dvh w-full md:max-w-2xl bg-paper z-70 shadow-overlay transform transition-transform duration-[420ms] flex flex-col ${
          claim ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/10 shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-ink">Claim Details</h2>
            <p className="font-mono text-xs text-ink-muted">{claim ? formatClaimRef(claim.id) : ""}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close claim details"
            className="p-2 bg-surface-muted rounded-full text-ink hover:bg-line transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        {claim && isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : claim && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

            {/* ① CONDITIONAL HEADER ─────────────────────────────────────── */}
            <div className="bg-accent/5 border border-accent/10 rounded-2xl p-5">

              {/* PENDING: show requested only — no approved field */}
              {isPending && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-body text-xs text-ink-muted uppercase tracking-wider mb-1">
                      Amount Submitted
                    </p>
                    <span className="font-display font-bold text-3xl text-ink">
                      {claim.amount}
                    </span>
                  </div>
                  <StatusBadge status={effectiveStatus} />
                </div>
              )}

              {/* REJECTED: requested | RM 0.00 approved */}
              {masterRejected && (
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <p className="font-body text-xs text-ink-muted uppercase tracking-wider mb-1">
                      Amount Requested
                    </p>
                    <span className="font-display font-bold text-3xl text-ink">
                      {claim.amount}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-body text-xs text-ink-muted uppercase tracking-wider mb-1">
                      Total Approved
                    </p>
                    <span className="font-display font-bold text-3xl text-danger">MYR 0.00</span>
                    <div className="mt-2"><StatusBadge status={effectiveStatus} /></div>
                  </div>
                </div>
              )}

              {/* PARTIALLY APPROVED: approved primary | requested strikethrough */}
              {isPartial && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <p className="font-body text-xs text-ink-muted uppercase tracking-wider mb-1">
                        Total Approved
                      </p>
                      <span className="font-display font-bold text-3xl text-accent">
                        {fmt(totalApproved)}
                      </span>
                    </div>
                    <div className="sm:text-right">
                      <p className="font-body text-xs text-ink-muted uppercase tracking-wider mb-1">
                        Amount Requested
                      </p>
                      <del className="font-display font-semibold text-xl text-ink-muted/50">
                        {claim.amount}
                      </del>
                    </div>
                  </div>
                  <div className="mt-3"><StatusBadge status={effectiveStatus} /></div>
                </>
              )}

              {/* APPROVED / PAID */}
              {!isPending && !masterRejected && !isPartial && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-body text-xs text-ink-muted uppercase tracking-wider mb-1">
                      Total Approved
                    </p>
                    <span className="font-display font-bold text-3xl text-ink">
                      {fmt(totalApproved)}
                    </span>
                  </div>
                  <StatusBadge status={effectiveStatus} />
                </div>
              )}
            </div>

            {!isPending && !masterRejected && (
              <MoneyFlow
                key={claim.id}
                reimId={claim.id}
                claimStatus={effectiveStatus === "Paid" ? "PAID" : "APPROVED"}
              />
            )}

            {/* ② HR NOTE ─────────────────────────────────────────────────── */}
            {claim.hrNote && <HRNoteBanner note={claim.hrNote} />}

            {/* CONTEXT META ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
              {claim.employee.department && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {claim.employee.department}
                </span>
              )}
              {claim.claimContext.destination && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {claim.claimContext.destination}
                </span>
              )}
              {claim.claimContext.departurDate && (
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {claim.claimContext.departurDate}
                  {claim.claimContext.arrivalDate && ` → ${claim.claimContext.arrivalDate}`}
                </span>
              )}
            </div>

            {/* ③ AUDIT TABLE ──────────────────────────────────────────────── */}
            <div>
              <h4 className="font-display font-semibold text-sm text-ink mb-3">
                Financial Breakdown
                <span className="ml-2 text-xs font-normal text-ink-muted/60">
                  ({items.length} receipt{items.length !== 1 ? "s" : ""})
                </span>
              </h4>

              <div className="space-y-2.5">
                {items.map((item, i) => (
                  <LineItemRow key={i} item={item} masterRejected={masterRejected} masterPending={isPending} />
                ))}
              </div>

              {/* Footer totals */}
              <div className="mt-3 rounded-xl overflow-hidden border border-line/10">
                <div className="flex items-center justify-between px-3 py-2.5 bg-surface-muted">
                  <span className="font-body text-sm font-semibold text-ink-muted">Total Requested</span>
                  <span className="font-display font-bold text-sm text-ink tabular-nums">
                    {fmt(totalRequested)}
                  </span>
                </div>
                {totalDeducted > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5 bg-danger/5 border-t border-danger/10">
                    <span className="font-body text-sm font-semibold text-danger/80">Total Deduction</span>
                    <span className="font-display font-bold text-sm text-danger tabular-nums">
                      − {fmt(totalDeducted)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-3 bg-accent/5 border-t border-accent/10">
                  <span className="font-body text-sm font-bold text-accent uppercase tracking-wide">
                    Net Approved
                  </span>
                  <span className="font-display font-bold text-base text-accent tabular-nums">
                    {fmt(totalApproved)}
                  </span>
                </div>
              </div>
            </div>

            {/* ④ TIMELINE ─────────────────────────────────────────────────── */}
            <div>
              <h4 className="font-display font-semibold text-sm text-ink mb-4">Timeline</h4>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-line/20 before:to-transparent">

                {/* Submitted */}
                <div className="relative flex items-start gap-4">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border border-paper bg-accent/10 shrink-0 z-10">
                    <CheckCircle2 className="w-4 h-4 fill-accent text-paper" />
                  </div>
                  <div className="w-full p-3 rounded-xl bg-surface border border-line/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-ink">Submitted</span>
                      <time className="font-mono text-xs text-ink-muted">{claim.date}</time>
                    </div>
                    <p className="text-sm text-ink-muted">Via Employee App</p>
                  </div>
                </div>

                {/* AI Validation */}
                <div className="relative flex items-start gap-4">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border border-paper bg-accent/10 shrink-0 z-10">
                    {isPending
                      ? <Clock className="w-4 h-4 text-accent" />
                      : <Sparkles className="w-4 h-4 text-accent" />}
                  </div>
                  <div className="w-full p-3 rounded-xl bg-surface border border-line/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-ink">AI Validation</span>
                      {!isPending && (
                        <time className="font-mono text-xs text-ink-muted">{claim.date}</time>
                      )}
                    </div>
                    <p className="text-sm text-ink-muted">
                      {isPending
                        ? "Processing receipt & policy check…"
                        : `${items.length} receipt${items.length !== 1 ? "s" : ""} extracted. Policy check completed.`}
                    </p>
                  </div>
                </div>

                {/* HR Review — only for non-pending */}
                {!isPending && (
                  <div className="relative flex items-start gap-4">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full border border-paper shrink-0 z-10 ${
                      masterRejected ? "bg-danger/10" : isPartial ? "bg-warning/10" : "bg-accent/10"
                    }`}>
                      {masterRejected
                        ? <AlertCircle className="w-4 h-4 fill-danger text-paper" />
                        : isPartial
                        ? <AlertTriangle className="w-4 h-4 fill-warning text-paper" />
                        : <CheckCircle2 className="w-4 h-4 fill-accent text-paper" />}
                    </div>
                    <div className="w-full p-3 rounded-xl bg-surface border border-line/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-ink">
                          {masterRejected ? "HR Rejected" : isPartial ? "HR Partially Approved" : "HR Approved"}
                        </span>
                        <time className="font-mono text-xs text-ink-muted">{claim.date}</time>
                      </div>
                      <p className="text-sm text-ink-muted">
                        {masterRejected
                          ? "Claim rejected — does not meet reimbursement policy."
                          : isPartial
                          ? `Adjustments made based on company policy. ${fmt(totalApproved)} of ${claim.amount} approved.`
                          : `Fully approved. ${fmt(totalApproved)} queued for processing.`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Paid Disbursed — only if Paid */}
                {effectiveStatus === "Paid" && (
                  <div className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border border-paper shrink-0 z-10 bg-accent/10">
                      <CheckCircle2 className="w-4 h-4 fill-accent text-paper" />
                    </div>
                    <div className="w-full p-3 rounded-xl bg-surface border border-line/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-ink">Paid</span>
                      </div>
                      <p className="text-sm text-ink-muted">Sent to your PayPal account.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ⑤ DOCUMENT ACTIONS — Official Form Only ─────────────────────── */}
            <div>
              <h4 className="font-display font-semibold text-sm text-ink mb-3">Documents</h4>
              <div className="bg-surface border border-line/10 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-accent/10 rounded-xl shrink-0">
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-sm text-ink">Official Claim Form</p>
                    <p className="font-body text-xs text-ink-muted">
                      {formatClaimRef(claim.id)}_claim_form.pdf
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Primary: opens A4 HTML modal */}
                  <button
                    id={`view-form-${claim.id}`}
                    onClick={openFormModal}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-accent text-on-accent font-body font-semibold text-sm hover:bg-accent/90 active:scale-95 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Official Claim Form
                  </button>
                  {/* Secondary: download PDF via settlement template */}
                  <a
                    id={`download-pdf-${claim.id}`}
                    href={claim.settlementTemplateUrl ? `${API_BASE}${claim.settlementTemplateUrl}` : "#"}
                    onClick={(e) => {
                      if (!claim.settlementTemplateUrl) {
                        e.preventDefault();
                      }
                    }}
                    download
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-line/20 text-ink-muted font-body font-semibold text-sm hover:bg-surface-muted transition-colors active:scale-95"
                    aria-label="Download Official Form (PDF)"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download PDF</span>
                  </a>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* A4 Claim Form Modal */}
      {showFormModal && claim && (
        <ClaimFormModal
          claim={claim}
          effectiveStatus={effectiveStatus}
          totalRequested={totalRequested}
          totalApproved={totalApproved}
          masterRejected={masterRejected}
          masterPending={isPending}
          onClose={closeFormModal}
        />
      )}
    </>
  );
}
