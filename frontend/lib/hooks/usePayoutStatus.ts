"use client";

import { useEffect, useState } from "react";
import { getPayout } from "@/lib/actions/paypal";
import { TERMINAL_PAYOUT_STATUSES, type PayoutInfoV2 } from "@/lib/api/reclaim-pay-types";

const POLL_MS = 3_000;
const GIVE_UP_MS = 120_000;

/**
 * Polls a claim's payout until it settles or two minutes pass.
 * Key the calling component by reimId so a new claim starts from a clean state.
 */
export function usePayoutStatus(reimId: string | null): {
  status: string | null;
  payout: PayoutInfoV2 | null;
  timedOut: boolean;
  loaded: boolean;
} {
  const [payout, setPayout] = useState<PayoutInfoV2 | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!reimId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      const next = await getPayout(reimId);
      if (cancelled) return;
      setPayout(next);
      setLoaded(true);
      if (next && TERMINAL_PAYOUT_STATUSES.includes(next.status)) return;
      if (Date.now() - startedAt >= GIVE_UP_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reimId]);

  return { status: payout?.status ?? null, payout, timedOut, loaded };
}
