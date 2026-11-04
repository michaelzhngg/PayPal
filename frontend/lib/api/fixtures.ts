// ─── Fixture Mode ────────────────────────────────────────────────────────────
// With NEXT_PUBLIC_RECLAIM_PAY_FIXTURES=1, actions return sample data instead of
// calling the backend, so screens can be built before their endpoints exist.
// ──────────────────────────────────────────────────────────────────────────────

export const FIXTURES_ON = process.env.NEXT_PUBLIC_RECLAIM_PAY_FIXTURES === "1";

export async function withFixture<T>(fixture: T, real: () => Promise<T>): Promise<T> {
  if (FIXTURES_ON) return structuredClone(fixture);
  return real();
}

/**
 * Picks one named fixture variant, so a screen's other states can be checked
 * without editing code, e.g. RECLAIM_PAY_FIXTURE_TRUST=trusted. Unknown names
 * fall back to the default variant.
 */
export function pickFixture<K extends string, T>(variants: Record<K, T>, name: string | undefined, fallback: K): T {
  return name && name in variants ? variants[name as K] : variants[fallback];
}
