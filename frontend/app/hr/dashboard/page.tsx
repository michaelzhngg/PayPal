"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Zap } from "lucide-react";
import type { ReimbursementRaw } from "@/lib/api/types";
import { getHRClaims } from "@/lib/actions/hr";
import { FIXTURES_ON } from "@/lib/api/fixtures";
import { useAuth } from "@/context/AuthContext";
import TriageQueue from "@/components/hr-grid/TriageQueue";
import type { TriageRow } from "@/components/hr-grid/rows";
import { FIXTURE_HR_USER_ID } from "@/src/mocks/triageFixtures";

export default function HRDashboardPage() {
  const { user } = useAuth();
  // Fixture claims belong to fixture users, so fixture mode stands in a matching HR id.
  const selfId = FIXTURES_ON ? FIXTURE_HR_USER_ID : (user?.user_id ?? null);

  const [rows, setRows] = useState<TriageRow[]>([]);
  const [allReims, setAllReims] = useState<ReimbursementRaw[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getHRClaims()
        .then(({ rows: triage, allReims: reims, error }) => {
          setRows(triage);
          setAllReims(reims);
          setLoadError(error ? "Couldn't load claims. Check your connection and try again." : null);
        })
        .catch(() => setLoadError("Couldn't load claims. Check your connection and try again."))
        .finally(() => setIsLoadingClaims(false)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const retry = () => {
    setIsLoadingClaims(true);
    void load();
  };

  const handleApproved = useCallback(
    (approvedIds: string[]) => {
      const done = new Set(approvedIds);
      setRows((prev) => prev.filter((r) => !done.has(r.reimId)));
      // Fixture data would bring the approved rows straight back, so only refetch against the backend.
      if (!FIXTURES_ON) void load();
    },
    [load],
  );

  const pendingReviews = rows.filter((r) => r.status === "REVIEW").length;

  // Auto-solve rate: (auto-approved + auto-rejected) / total
  const { autoSolveRate, autoSolvedCount, totalClaims } = useMemo(() => {
    const total = allReims.length;
    if (total === 0) return { autoSolveRate: 0, autoSolvedCount: 0, totalClaims: 0 };
    const autoSolved = allReims.filter(
      (r) =>
        r.reviewed_by == null &&
        ["APPROVED", "DISBURSING", "PAID", "REJECTED"].includes(r.status),
    ).length;
    return {
      autoSolveRate: (autoSolved / total) * 100,
      autoSolvedCount: autoSolved,
      totalClaims: total,
    };
  }, [allReims]);

  return (
    <div className="relative min-h-full px-4 py-6 sm:px-6 md:px-8 md:py-10">
      {/* Ambient glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[480px] h-[480px] rounded-full bg-primary opacity-[0.07] blur-[80px]" />
        <div className="absolute top-32 right-40 w-[320px] h-[320px] rounded-full bg-tertiary opacity-[0.06] blur-[64px]" />
        <div className="absolute -top-8 right-[15%] w-[200px] h-[200px] rounded-full bg-primary-container opacity-[0.12] blur-[48px]" />
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 relative z-10">
        <div className="max-w-2xl">
          <h2
            className="font-headline font-extrabold text-on-background mb-2 tracking-tight"
            style={{ fontSize: "2.5rem", letterSpacing: "-0.02em" }}
          >
            HR Dashboard
          </h2>
          <p className="text-primary font-body text-sm font-bold italic mb-4 tracking-wide">
            Automation where it's safe, judgment where it matters
          </p>
          <p className="text-on-surface-variant text-lg font-body">
            Manage exceptions and review automated approvals.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 relative z-10">
        {/* Auto-Solve Rate */}
        <div className="bg-surface-container-lowest/70 backdrop-blur-2xl rounded-xl p-6 shadow-[0_8px_40px_-12px_rgba(44,47,49,0.06)] relative overflow-hidden group hover:shadow-[0_16px_48px_-12px_rgba(70,71,211,0.12)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10">
            <p className="text-xs font-semibold font-headline text-on-surface-variant tracking-widest uppercase mb-2">
              Auto-Solve Rate
            </p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-extrabold font-headline text-on-surface">
                {isLoadingClaims ? "…" : `${autoSolveRate.toFixed(1)}%`}
              </span>
              {!isLoadingClaims && totalClaims > 0 && (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-1">
                  <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {autoSolvedCount} auto-solved
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-3">
              {isLoadingClaims ? "Loading…" : `of ${totalClaims} total claims`}
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-36 h-36 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-500" />
        </div>

        {/* Pending Manual Reviews */}
        <div className="bg-surface-container-lowest/70 backdrop-blur-2xl rounded-xl p-6 shadow-[0_8px_40px_-12px_rgba(44,47,49,0.06)] relative overflow-hidden group hover:shadow-[0_16px_48px_-12px_rgba(180,19,64,0.10)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10">
            <p className="text-xs font-semibold font-headline text-on-surface-variant tracking-widest uppercase mb-2">
              Pending Manual Reviews
            </p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-extrabold font-headline text-on-surface">
                {isLoadingClaims ? "…" : pendingReviews}
              </span>
              <span className="text-sm text-on-surface-variant font-medium mb-1">
                total requests
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-3">requires HR action</p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-36 h-36 bg-error/5 rounded-full blur-2xl group-hover:bg-error/12 group-hover:scale-110 transition-all duration-500" />
        </div>
      </div>

      {/* Triage queue */}
      <div className="relative z-10">
        <TriageQueue
          rows={rows}
          isLoading={isLoadingClaims}
          error={loadError}
          selfId={selfId}
          onRetry={retry}
          onApproved={handleApproved}
        />
      </div>
    </div>
  );
}
