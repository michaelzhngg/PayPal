"use server";

// ─── Autonomy Server Actions ─────────────────────────────────────────────────
// HR actions on the autonomy engine. Settings, kill switch and back-test join
// this file with their screens (Christian plan, Task 3).
// ──────────────────────────────────────────────────────────────────────────────

import { apiPost, API_PREFIX } from "@/lib/api/client";
import { withFixture } from "@/lib/api/fixtures";
import type { BatchApproveResult } from "@/lib/api/reclaim-pay-types";
import { fixtureBatchApprove } from "@/src/mocks/triageFixtures";

/**
 * Approves HR_QUICK claims in one call. The backend re-checks every claim and
 * returns the ones it refused in `skipped`, so a tier change since page load is safe.
 */
export async function batchApprove(
  reimIds: string[],
): Promise<{ result: BatchApproveResult | null; error: string | null }> {
  return withFixture({ result: fixtureBatchApprove(reimIds), error: null }, async () => {
    const res = await apiPost<BatchApproveResult>(`${API_PREFIX}/reimbursements/batch-approve`, { reim_ids: reimIds });
    if (res.error || !res.data) return { result: null, error: res.error ?? "No response from the server." };
    return { result: res.data, error: null };
  });
}
