"use server";

// ─── Recovery Server Actions (employee) ──────────────────────────────────────
// Overpayment notices and disputes. HR actions (create, invoice preview,
// execute, waive) join this file with the HR payouts screen.
// ──────────────────────────────────────────────────────────────────────────────

import { apiGet, apiPost, API_PREFIX } from "@/lib/api/client";
import { pickFixture, withFixture } from "@/lib/api/fixtures";
import type { DisputeError, Recovery, RecoveryStatus } from "@/lib/api/reclaim-pay-types";
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
    const result = await apiGet<Recovery[]>(`${API_PREFIX}/recoveries${query}`);
    return result.error ? null : (result.data ?? []);
  });
}

/**
 * POST /recoveries/{id}/dispute. The recovery moves to DISPUTED and HR is told.
 * The backend's 409 codes come back as DisputeError values, never as raw text.
 */
export async function disputeRecovery(
  recoveryId: string,
  note: string,
): Promise<{ recovery: Recovery | null; error: DisputeError | null }> {
  const base = recoveryVariants.open?.[0];
  const fixture = base
    ? { recovery: { ...base, recovery_id: recoveryId, status: "DISPUTED" as const, dispute_note: note }, error: null }
    : { recovery: null, error: "FAILED" as const };
  return withFixture(fixture, async () => {
    const result = await apiPost<Recovery>(`${API_PREFIX}/recoveries/${encodeURIComponent(recoveryId)}/dispute`, { note });
    if (result.data && !result.error) return { recovery: result.data, error: null };
    if (result.error?.includes("DISPUTE_WINDOW_CLOSED")) return { recovery: null, error: "WINDOW_CLOSED" };
    if (result.error?.includes("NOT_DISPUTABLE")) return { recovery: null, error: "NOT_DISPUTABLE" };
    return { recovery: null, error: "FAILED" };
  });
}
