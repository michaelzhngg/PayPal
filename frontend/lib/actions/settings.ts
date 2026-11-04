"use server";

import { apiGet, apiPut, API_PREFIX } from "@/lib/api/client";
import { pickFixture, withFixture } from "@/lib/api/fixtures";
import type { BankingDetails, User, UserProfileUpdate } from "@/lib/api/types";
import type { TrustInfo } from "@/lib/api/reclaim-pay-types";
import { trustVariants } from "@/src/mocks/reclaimPayFixtures";

export async function getBankingDetails(): Promise<BankingDetails> {
  const result = await apiGet<BankingDetails>(`${API_PREFIX}/employee/banking`);
  return result.data ?? { bank_code: null, bank_account_number: null, bank_account_holder_name: null, bank_name: null };
}

export async function updateProfile(
  data: UserProfileUpdate
): Promise<{ user: User | null; error: string | null }> {
  const result = await apiPut<User>(`${API_PREFIX}/auth/me`, data);
  return { user: result.data, error: result.error };
}

/**
 * The employee's fast-track level (GET /autonomy/me). Returns null on any
 * failure, a 404 included, so the dashboard hides the card instead of showing
 * a broken one.
 */
export async function getMyTrust(): Promise<TrustInfo | null> {
  const fixture = pickFixture(trustVariants, process.env.RECLAIM_PAY_FIXTURE_TRUST, "standard");
  return withFixture(fixture, async () => {
    const result = await apiGet<TrustInfo>(`${API_PREFIX}/autonomy/me`);
    return result.error ? null : result.data;
  });
}
