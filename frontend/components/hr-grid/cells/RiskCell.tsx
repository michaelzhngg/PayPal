import { riskBand, type RiskBand } from "../rows";

const BAND_FILL: Record<RiskBand, string> = {
  low: "bg-emerald-600",
  quick: "bg-amber-500",
  review: "bg-orange-600",
  dual: "bg-red-700",
};

/** A 0–100 bar plus the number, so the score never depends on reading the color. */
export function RiskBar({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <span className="inline-flex items-center gap-2" title={`Risk ${value} out of 100`}>
      <span
        role="meter"
        aria-label="Risk score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="relative h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-surface-container-high"
      >
        <span className={`absolute inset-y-0 left-0 rounded-full ${BAND_FILL[riskBand(value)]}`} style={{ width: `${value}%` }} />
      </span>
      <span className="tabular-nums text-xs font-semibold text-on-surface w-6">{value}</span>
    </span>
  );
}
