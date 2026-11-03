// ─── Fixture Mode ────────────────────────────────────────────────────────────
// With NEXT_PUBLIC_RECLAIM_PAY_FIXTURES=1, actions return sample data instead of
// calling the backend, so screens can be built before their endpoints exist.
// ──────────────────────────────────────────────────────────────────────────────

export const FIXTURES_ON = process.env.NEXT_PUBLIC_RECLAIM_PAY_FIXTURES === "1";

export async function withFixture<T>(fixture: T, real: () => Promise<T>): Promise<T> {
  if (FIXTURES_ON) return structuredClone(fixture);
  return real();
}
