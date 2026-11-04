"use client";

import { useState, useMemo, useEffect } from "react";
import {
  History,
  Search,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { getHRHistory, type HistoryClaim } from "@/lib/actions/hr";
import { formatMoney } from "@/lib/format";
import PayoutCell, { payoutDisplay } from "./_components/PayoutCell";
// ─── Types ────────────────────────────────────────────────────────────────────

type ClaimStatus = "Approved" | "Rejected" | "Paid";

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ClaimStatus,
  { label: string; bg: string; text: string; icon: typeof CheckCircle2; dot: string }
> = {
  Paid: {
    label: "Paid",
    bg: "bg-success-soft border border-success/30",
    text: "text-success",
    icon: Banknote,
    dot: "bg-success",
  },
  Approved: {
    label: "Approved",
    bg: "bg-accent/8 border border-accent/20",
    text: "text-accent",
    icon: CheckCircle2,
    dot: "bg-accent",
  },
  Rejected: {
    label: "Rejected",
    bg: "bg-danger-soft border border-danger/30",
    text: "text-danger",
    icon: XCircle,
    dot: "bg-danger",
  },
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-line/5">
      <td className="py-4 px-6 w-32"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-full" /></td>
      <td className="py-4 px-6"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-3/4" /></td>
      <td className="py-4 px-6"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-2/3" /></td>
      <td className="py-4 px-6 w-32"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-full" /></td>
      <td className="py-4 px-6 w-32"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-full" /></td>
      <td className="py-4 px-6 w-28"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-full" /></td>
      <td className="py-4 px-6 w-24"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-full" /></td>
      <td className="py-4 px-6 w-24"><div className="h-4 bg-surface-muted rounded-full animate-pulse w-full" /></td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 6;

export default function HRHistoryPage() {
  const [data, setData] = useState<HistoryClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ClaimStatus>("All");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setIsLoading(true);
    getHRHistory()
      .then(setData)
      .catch(() => setError("Failed to load claim history. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let result = data;
    if (statusFilter !== "All") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.employeeName.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.policyName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [data, searchQuery, statusFilter]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // ── KPI Summary ──
  const kpis = useMemo(() => {
    const fmt = (v: number) => formatMoney("MYR", v);
    const approved = data.filter((c) => c.status === "Approved" || c.status === "Paid");
    const rejected = data.filter((c) => c.status === "Rejected");
    const totalPaid = data
      .filter((c) => c.status === "Paid")
      .reduce((s, c) => s + c.amount, 0);
    return {
      total: data.length,
      approved: approved.length,
      rejected: rejected.length,
      totalPaid: fmt(totalPaid),
    };
  }, [data]);

  return (
    <div className="relative min-h-full p-6 md:p-10 lg:p-12">
      {/* Ambient glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[480px] h-[480px] rounded-full bg-accent opacity-[0.07] blur-[80px]" />
        <div className="absolute top-32 right-40 w-[320px] h-[320px] rounded-full bg-accent opacity-[0.06] blur-[64px]" />
        <div className="absolute -top-8 right-[15%] w-[200px] h-[200px] rounded-full bg-accent-soft opacity-[0.12] blur-[48px]" />
      </div>

      <div className="relative z-10">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <h2
              className="font-display font-bold text-ink mb-2"
              style={{ fontSize: "2.5rem", letterSpacing: "-0.02em" }}
            >
              Claim History
            </h2>
            <p className="text-ink-muted text-lg font-body">
              Every resolved claim, paid automatically or decided by HR.
            </p>
          </div>
        </div>

        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Resolved",
              value: isLoading ? "—" : kpis.total.toString(),
              sub: "all time",
              color: "text-ink",
              bg: "bg-accent/5",
              hoverShadow: "",
              icon: History,
              iconColor: "text-accent",
            },
            {
              label: "Approved / Paid",
              value: isLoading ? "—" : kpis.approved.toString(),
              sub: "claims",
              color: "text-accent",
              bg: "bg-accent/5",
              hoverShadow: "",
              icon: CheckCircle2,
              iconColor: "text-accent",
            },
            {
              label: "Rejected",
              value: isLoading ? "—" : kpis.rejected.toString(),
              sub: "claims",
              color: "text-danger",
              bg: "bg-danger/5",
              hoverShadow: "",
              icon: XCircle,
              iconColor: "text-danger",
            },
            {
              label: "Total Disbursed",
              value: isLoading ? "—" : kpis.totalPaid,
              sub: "paid out",
              color: "text-success",
              bg: "bg-success/5",
              hoverShadow: "",
              icon: Banknote,
              iconColor: "text-success",
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className={`bg-surface/70 rounded-xl p-5 relative overflow-hidden group ${stat.hoverShadow} hover:-translate-y-0.5 transition-all duration-300`}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold font-display text-ink-muted tracking-widest uppercase">
                    {stat.label}
                  </p>
                  <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${stat.iconColor}`} strokeWidth={2} />
                  </div>
                </div>
                <p className={`text-2xl font-bold font-display ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-ink-muted/70 mt-0.5">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="bg-surface-muted/50 border border-line/10 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted group-focus-within:text-accent transition-colors w-4 h-4" />
            <input
              type="text"
              placeholder="Search by employee name, claim ID, or policy…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-surface border border-line/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-ink-muted/50"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-ink-muted shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="bg-surface border border-line/10 rounded-xl px-4 py-3 text-sm font-medium text-ink-muted outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* ── Error State ── */}
        {error && (
          <div className="bg-danger-soft border border-danger/30 text-danger text-sm rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Table / Cards ── */}
        <div className="bg-surface/80 rounded-xl relative z-10">

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted/50 text-ink-muted uppercase tracking-wider text-[10px] font-bold font-display">
                  <th className="py-4 px-4 w-32">Claim</th>
                  <th className="py-4 px-4">Employee</th>
                  <th className="py-4 px-4">Policy</th>
                  <th className="py-4 px-4 w-32 text-right">Amount</th>
                  <th className="py-4 px-4 w-24">Resolved</th>
                  <th className="py-4 px-4 w-28">Status</th>
                  <th className="py-4 px-4 w-44">Payout</th>
                  <th className="py-4 px-4 w-20 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5">
                {/* Skeleton */}
                {isLoading &&
                  [...Array(ITEMS_PER_PAGE)].map((_, i) => <SkeletonRow key={i} />)}

                {/* Rows */}
                {!isLoading &&
                  paginated.map((claim) => {
                    const cfg = STATUS_CONFIG[claim.status];
                    const StatusIcon = cfg.icon;
                    const formatted = formatMoney(claim.currency, claim.amount);

                    return (
                      <tr
                        key={claim.id}
                        className="hover:bg-surface-muted/30 transition-colors group"
                      >
                        {/* Claim ID */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-ink-muted bg-surface-muted px-2 py-1 rounded-lg">
                            {claim.id}
                          </span>
                        </td>

                        {/* Employee */}
                        <td className="py-4 px-4 align-middle overflow-hidden">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-linear-to-br from-accent-soft to-accent-soft flex items-center justify-center font-bold text-[10px] text-accent-hover border-2 border-surface shrink-0">
                              {claim.employeeInitial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm text-ink truncate">
                                {claim.employeeName}
                              </p>
                              <p className="text-[10px] text-ink-muted truncate">
                                {claim.department}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Policy */}
                        <td className="py-4 px-4 align-middle overflow-hidden">
                          <p className="text-sm text-ink-muted line-clamp-2" title={claim.policyName}>
                            {claim.policyName}
                          </p>
                        </td>

                        {/* Amount */}
                        <td className="py-4 px-4 text-right align-middle">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <span className="font-semibold text-sm text-ink font-mono tabular-nums">
                              {formatted}
                            </span>
                          </div>
                        </td>

                        {/* Resolved Date */}
                        <td className="py-4 px-4 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-ink-muted/50 shrink-0" />
                            <span className="text-xs text-ink-muted">
                              {claim.dateResolved}
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4 align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Payout: where the money is, and why if it has not moved */}
                        <td className="py-4 px-4 align-middle">
                          <PayoutCell state={claim.payout} />
                        </td>

                        {/* View Action */}
                        <td className="py-4 px-4 text-right align-middle whitespace-nowrap">
                          <Link
                            href={`/hr/view/${claim.reim_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-muted hover:text-accent hover:bg-accent/10 transition-all active:scale-90 cursor-pointer"
                          >
                            View
                            <ExternalLink className="w-3 h-3" strokeWidth={2} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden flex flex-col gap-3 p-4">
            {isLoading &&
              [...Array(ITEMS_PER_PAGE)].map((_, i) => (
                <div key={i} className="bg-surface p-4 rounded-xl border border-line/10 flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-surface-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-surface-muted rounded-full w-2/3" />
                    <div className="h-2.5 bg-surface-muted rounded-full w-1/2" />
                  </div>
                  <div className="h-3 bg-surface-muted rounded-full w-16 shrink-0" />
                </div>
              ))}

            {!isLoading &&
              paginated.map((claim) => {
                const cfg = STATUS_CONFIG[claim.status];
                const formatted = formatMoney(claim.currency, claim.amount);
                const payout = payoutDisplay(claim.payout);

                return (
                  <Link
                    href={`/hr/view/${claim.reim_id}`}
                    key={claim.id}
                    className="bg-surface p-4 rounded-xl border border-line/10 flex items-center justify-between hover:bg-line/30 transition-colors active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-full bg-linear-to-br from-accent-soft to-accent-soft flex items-center justify-center font-bold text-[10px] text-accent-hover border-2 border-surface shrink-0">
                        {claim.employeeInitial}
                      </div>
                      <div className="min-w-0 pr-2">
                        <h4 className="font-display font-bold text-sm text-ink mb-0.5 truncate">
                          {claim.employeeName}
                        </h4>
                        <p className="font-body text-xs text-ink-muted truncate">
                          {claim.id} · {claim.policyName}
                        </p>
                        <p className={`font-body text-xs font-semibold truncate ${payout.className}`}>
                          Payout: {payout.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-sm text-ink mb-1 tabular-nums">
                          {formatted}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-ink-muted opacity-60" />
                    </div>
                  </Link>
                );
              })}
          </div>

        </div>

          {/* Empty State */}
          {!isLoading && filtered.length === 0 && (
            <div className="p-16 text-center">
              <div className="inline-flex p-4 bg-surface-muted rounded-full mb-4">
                <Inbox className="w-8 h-8 text-ink-muted/40" />
              </div>
              <p className="font-display font-bold text-lg text-ink">
                No claims found
              </p>
              <p className="text-ink-muted text-sm mt-1">
                {data.length === 0
                  ? "Resolved claims will appear here once they age out of the dashboard."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          )}

          {/* ── Pagination Footer ── */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-6 py-4 border-t border-line/10 flex items-center justify-between gap-4">
              <p className="text-xs text-ink-muted">
                Showing{" "}
                <span className="font-semibold text-ink">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-ink">{filtered.length}</span>{" "}
                results
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg text-ink-muted hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {[...Array(Math.min(totalPages, 7))].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === i + 1
                        ? "bg-accent text-on-accent"
                        : "text-ink-muted hover:bg-surface-muted"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg text-ink-muted hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90 cursor-pointer"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
