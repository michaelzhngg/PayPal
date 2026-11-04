"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, CheckCircle2, CreditCard, Upload } from "lucide-react";
import { getDashboardStats, getRecentClaims } from "@/lib/actions/dashboard";
import { getMyTrust } from "@/lib/actions/settings";
import { listRecoveries } from "@/lib/actions/recoveries";
import { useAuth } from "@/context/AuthContext";
import type { ClaimSummary, DashboardStats } from "@/lib/api/types";
import type { Recovery, TrustInfo } from "@/lib/api/reclaim-pay-types";

import StatCard          from "./_components/StatCard";
import RecentClaimsTable from "./_components/RecentClaimsTable";
import PayPalStatusChip  from "./_components/PayPalStatusChip";
import AccountStatus     from "./_components/AccountStatus";

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  // null while loading, so the empty state never flashes before data arrives
  const [claims, setClaims] = useState<ClaimSummary[] | null>(null);
  const [today, setToday] = useState("");
  // undefined while loading, null when the endpoint failed: both cards then stay hidden
  const [trust, setTrust] = useState<TrustInfo | null | undefined>(undefined);
  const [recoveries, setRecoveries] = useState<Recovery[] | null | undefined>(undefined);

  // Show only the first name in the greeting
  const firstName = user?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    getDashboardStats().then(setStats);
    getRecentClaims(3).then(setClaims).catch(() => setClaims([]));
    getMyTrust().then(setTrust).catch(() => setTrust(null));
    listRecoveries("NOTICE_SENT").then(setRecoveries).catch(() => setRecoveries(null));
  }, []);

  // Render date client-only to avoid hydration mismatch
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  const isEmpty = claims !== null && claims.length === 0;

  return (
    /*
     * The nav shell (SideNav, TopNav, BottomNav) is now provided by
     * app/employee/layout.tsx — this page only owns the scrollable content.
     */
    <div className="px-4 pt-6 pb-20 md:p-8 lg:p-12 lg:pb-8">

      {/* ── 1. Greeting + where payouts go ─────────── */}
      <section
        aria-label="Welcome section"
        className="mb-6 md:mb-10 relative"
      >
        {/* Background gradient decorative element */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-linear-to-br from-[#4647D3]/20 to-[#9E00B4]/10 rounded-full blur-3xl pointer-events-none z-0" />

        <div className="flex flex-wrap items-start justify-between gap-3 relative z-10">
          <div className="flex flex-col gap-3">
            <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
              Welcome back, {firstName}.
            </h2>
            <PayPalStatusChip />
          </div>

          {/* Current date pill — visible on md+ */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-surface-container-low rounded-xl shrink-0">
            <span className="font-label text-sm font-semibold text-primary">
              {today || "Loading..."}
            </span>
          </div>
        </div>
      </section>

      {/* Fast-track and overpayment notices sit under the PayPal chip, except on
          first run, where they follow the upload prompt so it stays in view on phones. */}
      {!isEmpty && <AccountStatus trust={trust} recoveries={recoveries} className="mb-6 md:mb-10" />}

      {isEmpty ? (
        /* ── First run: one clear next step instead of zero cards ── */
        <section
          aria-labelledby="empty-claims-heading"
          className="bg-surface-container-low rounded-2xl p-6 md:p-10 flex flex-col items-start gap-4 max-w-xl"
        >
          <h3 id="empty-claims-heading" className="font-headline text-xl font-bold text-on-surface">
            No claims yet
          </h3>
          <p className="font-body text-sm text-on-surface-variant leading-relaxed">
            Snap or upload a receipt. We read it, check it against your policy, and pay approved claims to your PayPal.
          </p>
          <Link
            href="/employee/claims"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-body text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload your first receipt
          </Link>
        </section>
      ) : (
        <>
          {/* ── 2. KPI cards ─────────────────── */}
          <section
            aria-label="Key metrics"
            className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-10"
          >
            <StatCard
              label="Awaiting Review"
              value={stats?.awaitingReview.amount ?? "MYR …"}
              subtext={`${stats?.awaitingReview.count ?? 0} claims processing`}
              icon={History}
              variant="pending"
            />
            <StatCard
              label="Reimbursed This Month"
              value={stats?.reimbursedThisMonth.amount ?? "MYR …"}
              subtext={`${stats?.reimbursedThisMonth.count ?? 0} claims settled`}
              icon={CheckCircle2}
              variant="approved"
            />
            <StatCard
              label="Already Paid"
              value={stats?.alreadyPaid.amount ?? "MYR …"}
              subtext={`${stats?.alreadyPaid.count ?? 0} claims paid`}
              icon={CreditCard}
              variant="paid"
            />
          </section>

          {/* ── 3. Recent Claims ──────────────────── */}
          <RecentClaimsTable claims={claims} />
        </>
      )}

      {isEmpty && <AccountStatus trust={trust} recoveries={recoveries} className="mt-6 max-w-xl md:max-w-none" />}

    </div>
  );
}
