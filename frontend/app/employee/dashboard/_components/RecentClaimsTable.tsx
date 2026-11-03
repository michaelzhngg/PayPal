"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { ClaimSummary } from "@/lib/api/types";
import { formatClaimRef } from "@/lib/format";
import { categoryIcon } from "@/app/employee/history/_components/historyData";

/* ─── Types ──────────────────────────────────────────── */
type ClaimStatus = "Pending" | "Approved" | "Paid" | "Rejected";

/* ─── Status styling maps ────────────────────────────── */
const STATUS_BADGE: Record<ClaimStatus, string> = {
  "Pending":    "bg-secondary-container/50 text-on-secondary-container",
  "Approved":   "bg-primary/10 text-primary",
  "Paid": "bg-tertiary/10 text-tertiary",
  "Rejected": "bg-error/10 text-error",
};

const STATUS_DOT: Record<ClaimStatus, string> = {
  "Pending":    "bg-secondary",
  "Approved":   "bg-primary",
  "Paid": "bg-tertiary",
  "Rejected": "bg-error",
};

const claimHref = (id: string) => `/employee/history?claimId=${id}`;

/* ─── Component ──────────────────────────────────────── */
/** `claims` is null while loading. The page shows its own empty state when there are none. */
export default function RecentClaimsTable({ claims }: { claims: ClaimSummary[] | null }) {
  const router = useRouter();

  return (
    <section
      aria-labelledby="recent-claims-heading"
      className="bg-surface-container-low rounded-2xl p-4 md:p-6 shadow-[0_8px_40px_-12px_rgba(44,47,49,0.06)]"
    >
      {/* Section header */}
      <div className="flex justify-between items-center mb-5">
        <h3
          id="recent-claims-heading"
          className="font-headline text-xl font-bold text-on-surface"
        >
          Recent Claims
        </h3>
        <Link
          id="recent-claims-view-all-btn"
          href="/employee/history"
          className="min-h-11 text-primary font-body text-sm font-semibold hover:underline underline-offset-4 flex items-center gap-1 active:scale-95 transition-transform"
        >
          View all claims
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>

      {claims === null && (
        <p className="font-body text-sm text-on-surface-variant py-6" role="status">
          Loading your recent claims…
        </p>
      )}

      {claims && claims.length > 0 && (
        <>
          {/* ── Desktop: Full table ───────────────────────── */}
          <div className="hidden md:block overflow-x-auto bg-surface-container-lowest rounded-xl border border-outline-variant/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-body text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold rounded-tl-xl">Claim</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Policy</th>
                  <th className="p-4 font-semibold">Merchant</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold rounded-tr-xl">Status</th>
                </tr>
              </thead>
              <tbody className="font-body text-sm">
                {claims.map((claim) => {
                  const Icon = categoryIcon(claim.category);
                  return (
                    <tr
                      key={claim.id}
                      onClick={() => router.push(claimHref(claim.id))}
                      className="border-t border-outline-variant/5 hover:bg-surface-container-highest/40 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-medium text-on-surface">
                        <Link
                          href={claimHref(claim.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs bg-surface-container px-2 py-1 rounded-lg hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          {formatClaimRef(claim.id)}
                        </Link>
                      </td>
                      <td className="p-4 text-on-surface-variant">{claim.date}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-surface-variant rounded-lg text-on-surface-variant">
                            <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                          </div>
                          <span className="text-on-surface">{claim.category}</span>
                        </div>
                      </td>
                      <td className="p-4 text-on-surface">
                        {claim.merchant || <span className="text-on-surface-variant">{claim.subCategory}</span>}
                      </td>
                      <td className="p-4 font-semibold text-on-surface tabular-nums">
                        {claim.amount}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[claim.status as ClaimStatus] ?? ""}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[claim.status as ClaimStatus] ?? ""}`}
                          />
                          {claim.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: Card list ─────────────────────────── */}
          <div className="md:hidden flex flex-col gap-3">
            {claims.map((claim) => {
              const Icon = categoryIcon(claim.category);
              return (
                <Link
                  key={claim.id}
                  href={claimHref(claim.id)}
                  className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 flex items-center justify-between hover:bg-surface-container-highest/30 transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {/* Left: icon + meta */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 bg-surface-container rounded-xl text-on-surface-variant shrink-0">
                      <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-headline font-bold text-sm text-on-surface mb-0.5 truncate">
                        {claim.merchant || claim.category}
                      </h4>
                      <p className="font-body text-xs text-on-surface-variant truncate">
                        {claim.date.split(",")[0]} &bull; <span className="font-mono">{formatClaimRef(claim.id)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: amount + badge */}
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-headline font-bold text-sm text-on-surface mb-1 tabular-nums">
                      {claim.amount}
                    </p>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[claim.status as ClaimStatus] ?? ""}`}
                    >
                      {claim.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
