import {
  FilterState,
  uniqueValues,
} from "@/lib/hooks/useClaimsFilter";
import { STATUS_ICON, STATUS_STYLE } from "./StatusBadge";
import type { AiStatus, Claim } from "@/lib/api/types";

export function FilterPanel({
  claims,
  filters,
  onChange,
  onClear,
}: {
  claims: Claim[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}) {
  const allStatuses = uniqueValues(claims, "status") as AiStatus[];
  const allCategories = uniqueValues(claims, "category");

  function toggleStatus(s: AiStatus) {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    onChange({ ...filters, statuses: next });
  }

  function toggleCategory(cat: string) {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((x) => x !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  }

  return (
    <div className="px-6 pt-4 pb-5 bg-surface-muted/60 border-b border-line/10
                    flex flex-col gap-4">

      {/* ── Row 1: Status + Amount Range + Clear ──────────────────────── */}
      <div className="flex flex-wrap items-start gap-6">

        {/* Status chips */}
        <div className="flex-1 min-w-[200px]">
          <p className="text-[11px] font-semibold font-display text-ink-muted
                        uppercase tracking-widest mb-2">
            AI Status
          </p>
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((s) => {
              const active = filters.statuses.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                              font-semibold font-body border transition-all duration-150
                              active:scale-95 cursor-pointer ${
                                active
                                  ? `${STATUS_STYLE[s]} border-current shadow-sm`
                                  : "bg-surface border-line/20 text-ink-muted hover:border-line/50"
                              }`}
                >
                  {active && STATUS_ICON[s]}
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount range */}
        <div className="shrink-0">
          <p className="text-[11px] font-semibold font-display text-ink-muted
                        uppercase tracking-widest mb-2">
            Amount Range
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface rounded-lg
                            ring-1 ring-line/20 focus-within:ring-accent/40
                            px-3 py-2 w-28 transition-all">
              <span className="text-xs text-ink-muted mr-1">$</span>
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.amountMin}
                onChange={(e) => onChange({ ...filters, amountMin: e.target.value })}
                className="w-full bg-transparent text-sm text-ink outline-none font-body"
              />
            </div>
            <span className="text-ink-muted text-xs shrink-0">–</span>
            <div className="flex items-center bg-surface rounded-lg
                            ring-1 ring-line/20 focus-within:ring-accent/40
                            px-3 py-2 w-28 transition-all">
              <span className="text-xs text-ink-muted mr-1">$</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.amountMax}
                onChange={(e) => onChange({ ...filters, amountMax: e.target.value })}
                className="w-full bg-transparent text-sm text-ink outline-none font-body"
              />
            </div>
          </div>
        </div>

        {/* Clear all — top-right of row 1 */}
        <button
          onClick={onClear}
          className="self-end text-xs font-semibold text-ink-muted
                     hover:text-danger transition-colors active:scale-95 shrink-0 pb-2.5"
        >
          Clear all filters
        </button>
      </div>

      {/* ── Row 2: Category — horizontal scroll strip ──────────────────── */}
      <div>
        <p className="text-[11px] font-semibold font-display text-ink-muted
                      uppercase tracking-widest mb-2">
          Category
        </p>
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1
                        scrollbar-thin scrollbar-thumb-outline-variant/30 scrollbar-track-transparent">
          {allCategories.map((cat) => {
            const active = filters.categories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold font-body
                            border transition-all duration-150 active:scale-95 cursor-pointer ${
                              active
                                ? "bg-accent/10 text-accent border-accent/30"
                                : "bg-surface border-line/20 text-ink-muted hover:border-line/50"
                            }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
