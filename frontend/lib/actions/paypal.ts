"use server";

// ─── PayPal Server Actions ───────────────────────────────────────────────────
// Payee linking ("Log in with PayPal"), payout status and the HR payout ledger.
// ──────────────────────────────────────────────────────────────────────────────

import { apiGet, apiDelete, API_PREFIX } from "@/lib/api/client";
import { withFixture } from "@/lib/api/fixtures";
import type { LedgerFilters, PayeeStatus, PayoutInfoV2, PayoutLedgerRow } from "@/lib/api/reclaim-pay-types";
import { ledgerRows, payee, payoutS1 } from "@/src/mocks/reclaimPayFixtures";

/** Current employee's linked PayPal account. */
export async function getPayeeStatus(): Promise<PayeeStatus | null> {
  return withFixture<PayeeStatus | null>(payee, async () => {
    const result = await apiGet<PayeeStatus>(`${API_PREFIX}/paypal/status`);
    return result.data;
  });
}

/** URL that starts "Log in with PayPal". The browser navigates to it. */
export async function getConnectUrl(): Promise<{ url: string | null; error: string | null }> {
  return withFixture({ url: "/employee/settings?paypal=linked", error: null }, async () => {
    const result = await apiGet<{ url: string }>(`${API_PREFIX}/paypal/connect-url`);
    return { url: result.data?.url ?? null, error: result.error };
  });
}

export async function unlinkPayPal(): Promise<{ error: string | null }> {
  return withFixture({ error: null }, async () => {
    const result = await apiDelete<null>(`${API_PREFIX}/paypal/link`);
    return { error: result.error };
  });
}

/** Latest payout for a claim, or null when none exists yet. */
export async function getPayout(reimId: string): Promise<PayoutInfoV2 | null> {
  return withFixture<PayoutInfoV2 | null>({ ...payoutS1, reim_id: reimId }, async () => {
    const result = await apiGet<PayoutInfoV2>(`${API_PREFIX}/payouts/${reimId}`);
    return result.data;
  });
}

/** HR payout ledger. */
export async function getLedger(filters: LedgerFilters = {}): Promise<PayoutLedgerRow[]> {
  return withFixture(ledgerRows, async () => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const query = params.size ? `?${params}` : "";
    const result = await apiGet<PayoutLedgerRow[]>(`${API_PREFIX}/payouts/${query}`);
    return result.data ?? [];
  });
}
