"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { getLedger } from "@/lib/actions/paypal";
import type { PayoutLedgerRow, PayoutStatus } from "@/lib/api/reclaim-pay-types";
import LedgerGrid from "@/components/hr-grid/LedgerGrid";
import {
  STATUS_META,
  filterByStatus,
  hasInFlight,
  sortByUpdatedDesc,
  summarize,
  type StatusFilter,
} from "@/components/hr-grid/ledger";

const POLL_MS = 5000;

const STATUS_OPTIONS = Object.keys(STATUS_META) as PayoutStatus[];

function LedgerSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-[52px] rounded-lg bg-surface-container-low animate-pulse" />
      ))}
    </div>
  );
}

export default function HRPayoutsPage() {
  const [rows, setRows] = useState<PayoutLedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const load = useCallback(
    () =>
      getLedger()
        .then((data) => {
          setRows(sortByUpdatedDesc(data));
          setError(null);
        })
        .catch(() => setError("Couldn't load payouts. Check your connection and try again."))
        .finally(() => setIsLoading(false)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const inFlight = hasInFlight(rows);

  // Poll only while PayPal is still processing something; stop once everything settles.
  useEffect(() => {
    if (!inFlight) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [inFlight, load]);

  const visible = useMemo(() => filterByStatus(rows, status), [rows, status]);
  const counts = useMemo(() => summarize(rows), [rows]);

  const retry = () => {
    setIsLoading(true);
    load();
  };

  return (
    <div className="min-h-full px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <header className="mb-6 max-w-3xl">
        <h2 className="font-headline font-extrabold text-on-background text-3xl md:text-4xl tracking-tight">
          Payouts
        </h2>
        <p className="text-on-surface-variant text-base font-body mt-2">
          Every PayPal payout sent for an approved claim, with its latest status from PayPal.
        </p>
      </header>

      {/* Audit queue, Recoveries and Agent log return as tabs one at a time, once each is built (UX QA Q5). */}
      <section aria-label="Payout ledger">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <p className="text-sm text-on-surface-variant" aria-live="polite">
            {isLoading ? (
              "Loading payouts…"
            ) : (
              <>
                <span className="font-semibold text-on-surface">{counts.total}</span>{" "}
                {counts.total === 1 ? "payout" : "payouts"}
                {counts.inFlight > 0 && (
                  <>
                    {", "}
                    <span className="font-semibold text-amber-900">{counts.inFlight} processing</span>
                  </>
                )}
                {counts.failed > 0 && (
                  <>
                    {", "}
                    <span className="font-semibold text-red-700">{counts.failed} failed or reversed</span>
                  </>
                )}
              </>
            )}
          </p>

          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="min-h-[44px] bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-3 text-sm font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
            >
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading && <LedgerSkeleton />}

        {!isLoading && error && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-lg bg-surface-container-lowest border border-red-200 font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && visible.length === 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-14 text-center">
            <Inbox className="w-8 h-8 mx-auto text-on-surface-variant/60" aria-hidden="true" />
            <p className="font-headline font-bold text-lg text-on-surface mt-3">
              {rows.length === 0 ? "No payouts yet" : "No payouts with this status"}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {rows.length === 0
                ? "Payouts appear here once an approved claim is sent to PayPal."
                : "Choose a different status to see other payouts."}
            </p>
          </div>
        )}

        {!isLoading && !error && visible.length > 0 && <LedgerGrid rows={visible} />}
      </section>
    </div>
  );
}
