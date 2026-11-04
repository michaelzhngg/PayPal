"use server";

// ─── Recovery Server Actions (employee) ──────────────────────────────────────
// Overpayment notices and disputes. HR actions (create, invoice preview,
// execute, waive) join this file with the HR payouts screen.
// ──────────────────────────────────────────────────────────────────────────────

import { apiGet, apiPost, API_PREFIX } from "@/lib/api/client";
import { pickFixture, withFixture } from "@/lib/api/fixtures";
import type { Recovery, RecoveryStatus } from "@/lib/api/reclaim-pay-types";
import { recoveryVariants } from "@/src/mocks/reclaimPayFixtures";

/**
 * GET /recoveries?status=…. For an employee the backend returns only their own.
 * Returns null on any failure, a 404 included, so the notice stays hidden.
 */
export async function listRecoveries(status?: RecoveryStatus): Promise<Recovery[] | null> {
  const variant = pickFixture(recoveryVariants, process.env.RECLAIM_PAY_FIXTURE_RECOVERY, "open");
  const fixture = variant?.filter(r => !status || r.status === status) ?? null;
  return withFixture(fixture, async () => {
    const query = status ? `?status=${status}` : "";
    const result = await apiGet<Recovery[]>(`${API_PREFIX}/recoveries/${query}`);
    return result.error ? null : (result.data ?? []);
  });
}

/** POST /recoveries/{id}/dispute. The recovery moves to DISPUTED and HR is told. */
export async function disputeRecovery(
  recoveryId: string,
  note: string,
): Promise<{ recovery: Recovery | null; error: string | null }> {
  const base = recoveryVariants.open?.[0];
  const fixture = base
    ? { recovery: { ...base, recovery_id: recoveryId, status: "DISPUTED" as const, dispute_note: note }, error: null }
    : { recovery: null, error: "No recovery to dispute." };
  return withFixture(fixture, async () => {
    const result = await apiPost<Recovery>(`${API_PREFIX}/recoveries/${encodeURIComponent(recoveryId)}/dispute`, { note });
    if (result.error || !result.data) return { recovery: null, error: result.error ?? "No response from the server." };
    return { recovery: result.data, error: null };
  });
}
