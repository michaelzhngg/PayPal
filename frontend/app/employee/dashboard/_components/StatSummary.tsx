import type { DashboardStats } from "@/lib/api/types";

const PLACEHOLDER = "MYR …";

function claimsLine(count: number | undefined, verb: string): string {
  const n = count ?? 0;
  return `${n} ${n === 1 ? "claim" : "claims"} ${verb}`;
}

/**
 * The three totals as one panel, ordered by importance: money still in review
 * leads, the two settled totals sit beside it as a quieter list. Amounts are
 * Plex Mono so the figures line up like a receipt.
 */
export default function StatSummary({ stats }: { stats: DashboardStats | null }) {
  const secondary = [
    {
      label: "Reimbursed this month",
      amount: stats?.reimbursedThisMonth.amount ?? PLACEHOLDER,
      note: claimsLine(stats?.reimbursedThisMonth.count, "settled"),
    },
    {
      label: "Already paid",
      amount: stats?.alreadyPaid.amount ?? PLACEHOLDER,
      note: claimsLine(stats?.alreadyPaid.count, "paid"),
    },
  ];

  return (
    <section
      aria-label="Key metrics"
      aria-busy={stats === null}
      className="mb-6 md:mb-10 rounded-card border border-line bg-surface md:grid md:grid-cols-[3fr_2fr]"
    >
      <div className="p-5 md:p-6">
        <h3 className="font-body text-sm font-medium text-ink-muted">Awaiting review</h3>
        <p className="mt-2 font-mono text-3xl md:text-4xl font-medium text-ink break-words">
          {stats?.awaitingReview.amount ?? PLACEHOLDER}
        </p>
        <p className="mt-2 font-body text-sm text-ink-muted">
          {claimsLine(stats?.awaitingReview.count, "processing")}
        </p>
      </div>

      <div className="border-t border-line md:border-t-0 md:border-l divide-y divide-line">
        {secondary.map(item => (
          <div key={item.label} className="flex items-baseline justify-between gap-4 px-5 py-4 md:px-6">
            <div className="min-w-0">
              <p className="font-body text-sm text-ink">{item.label}</p>
              <p className="font-body text-xs text-ink-muted mt-0.5">{item.note}</p>
            </div>
            <p className="font-mono text-base md:text-lg font-medium text-ink text-right shrink-0">
              {item.amount}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
