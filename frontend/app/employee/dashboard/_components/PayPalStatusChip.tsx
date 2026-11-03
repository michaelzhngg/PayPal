"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, ChevronRight } from "lucide-react";
import { getPayeeStatus } from "@/lib/actions/paypal";
import type { PayeeStatus } from "@/lib/api/reclaim-pay-types";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Tells the employee where payouts go, or how to set that up. */
export default function PayPalStatusChip() {
  const [status, setStatus] = useState<PayeeStatus | null | undefined>(undefined);

  useEffect(() => {
    getPayeeStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  // Loading, or the status request failed: say nothing rather than guess.
  if (status === undefined) {
    return <div className="h-11 w-56 rounded-xl bg-surface-container animate-pulse" aria-hidden />;
  }
  if (status === null) return null;

  if (status.linked) {
    return (
      <Link
        href="/employee/settings#paypal"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3.5 py-2 text-sm font-body text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Wallet className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <span>
          Paid to <span className="font-semibold">{status.email_masked ?? "your PayPal"}</span>
          {status.cooldown_until && (
            <span className="text-on-surface-variant"> · Instant payouts paused until {shortDate(status.cooldown_until)}</span>
          )}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/employee/settings#paypal"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-body font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Wallet className="h-4 w-4 shrink-0" aria-hidden />
      Connect PayPal to get paid
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}
