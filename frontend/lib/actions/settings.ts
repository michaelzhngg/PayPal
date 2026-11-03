"use server";

import { apiGet, apiPut, API_PREFIX } from "@/lib/api/client";
import type { BankingDetails, User, UserProfileUpdate } from "@/lib/api/types";

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
