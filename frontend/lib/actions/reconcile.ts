"use server";

import { apiGet, API_PREFIX } from "@/lib/api/client";
import { withFixture } from "@/lib/api/fixtures";

export interface ReconcileMismatch {
  payout_id: string;
  reim_id: string;
  claim_ref: string;
  employee_name: string;
  amount: number;
  currency: string;
  created_at: string;
  reason: "MISSING_IN_PAYPAL";
}

export interface ReconcileUnknown {
  transaction_id: string;
  amount: number;
  currency: string;
  occurred_at: string;
}

export interface ReconcileSummary {
  /** "ok" is a real comparison. Otherwise nothing was compared and `message` says why. */
  state: "ok" | "no_data" | "unavailable";
  reconciled: number;
  total: number;
  pending: number;
  mismatches: ReconcileMismatch[];
  unknown_in_paypal: ReconcileUnknown[];
  days: number;
  checked_at: string;
  data_through: string | null;
  mock: boolean;
  message: string | null;
}

const fixture = (days: number): ReconcileSummary => ({
  state: "ok",
  reconciled: 2,
  total: 4,
  pending: 1,
  mismatches: [
    {
      payout_id: "00000000-0000-4000-8000-000000000001",
      reim_id: "1a2b3c4d-0000-4000-8000-000000000001",
      claim_ref: "RC-1A2B3C4D",
      employee_name: "Demo Employee",
      amount: 48,
      currency: "MYR",
      created_at: "2026-11-03T10:00:05Z",
      reason: "MISSING_IN_PAYPAL",
    },
  ],
  unknown_in_paypal: [],
  days,
  checked_at: "2026-11-04T10:00:00Z",
  data_through: "2026-11-04T09:00:00Z",
  mock: true,
  message: null,
});

/** HR ledger reconciliation. A failed request reads as "unavailable", never as a mismatch. */
export async function getReconciliation(days = 7): Promise<ReconcileSummary> {
  return withFixture(fixture(days), async () => {
    const result = await apiGet<ReconcileSummary>(`${API_PREFIX}/payouts/reconcile?days=${days}`);
    if (result.data && !result.error) return result.data;
    return {
      state: "unavailable",
      reconciled: 0,
      total: 0,
      pending: 0,
      mismatches: [],
      unknown_in_paypal: [],
      days,
      checked_at: new Date().toISOString(),
      data_through: null,
      mock: false,
      message: "Couldn't check payouts against PayPal.",
    };
  });
}
