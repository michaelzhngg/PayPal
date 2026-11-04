"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

// The four lanes and the hard stops, word for word from README ("The four lanes",
// "Hard stops"). The employee wording comes from components/timeline/copy.ts.
const LANES = [
  {
    name: "Auto-pay",
    range: "risk 0 to 19",
    when: "Risk 0 to 19 and no hard stop.",
    then: "Paid to the employee's verified PayPal account right away (PayPal sandbox in this demo).",
    employee: "Paid automatically",
  },
  {
    name: "Quick HR approval",
    range: "risk 20 to 49",
    when: "Risk 20 to 49, or any hard stop.",
    then: "One click for HR, and it can be done in batches.",
    employee: "Quick HR check",
  },
  {
    name: "HR review",
    range: "risk 50 to 79",
    when: "Risk 50 to 79, any high-risk signal, or the AI didn't approve.",
    then: "HR reviews the evidence and decides.",
    employee: "HR review",
  },
  {
    name: "Two-person review",
    range: "risk 80 or more",
    when: "Risk 80 or more, a duplicate, an AI-generated or injected receipt, or over RM1,000.",
    then: "Two different HR members approve. HR can't approve their own claim.",
    employee: "HR review",
  },
];

const HARD_STOPS = [
  "kill switch",
  "circuit breaker",
  "AI didn't approve",
  "unverified PayPal account",
  "account changed in the last 72 hours",
  "HR's own claim",
  "over the category budget",
  "over the trust limit",
  "over the RM300 daily cap",
  "over the RM1,000 monthly cap",
  "company RM2,000 daily budget used up",
  "any high-risk signal",
  "expected loss of RM15 or more",
];

export default function Lanes() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % LANES.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + LANES.length) % LANES.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = LANES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  const lane = LANES[active];

  return (
    <section id="lanes" aria-labelledby="lanes-heading" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-12 lg:py-24">
        <h2 id="lanes-heading" className="max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-[2.75rem]">
          Four lanes, picked by fixed rules
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
          The rules apply from the last lane up, and the first match wins. Choose a lane to see its rule.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
          <div role="tablist" aria-orientation="vertical" aria-label="Lanes" className="self-start border-y border-line">
            {LANES.map((l, i) => {
              const selected = i === active;
              return (
                <button
                  key={l.name}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  id={`${base}-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${base}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`flex min-h-14 w-full items-baseline justify-between gap-4 border-b border-line px-3 py-4 text-left transition-colors last:border-b-0 ${
                    selected ? "bg-ink text-paper" : "text-ink hover:bg-surface-muted"
                  }`}
                >
                  <span className="flex items-baseline gap-3">
                    <span className={`font-mono text-xs ${selected ? "text-paper/70" : "text-ink-muted"}`}>
                      {i + 1}
                    </span>
                    <span className="font-display text-lg font-semibold sm:text-xl">{l.name}</span>
                  </span>
                  <span className={`font-mono text-xs ${selected ? "text-paper/80" : "text-ink-muted"}`}>
                    {l.range}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id={`${base}-panel`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${active}`}
            tabIndex={0}
            className="rounded-card border border-line bg-paper p-5 sm:p-7"
          >
            <p className="font-display text-2xl font-semibold text-ink">{lane.name}</p>
            <dl className="mt-5 space-y-4 text-base">
              <div>
                <dt className="text-sm text-ink-muted">When</dt>
                <dd className="mt-1 text-ink">{lane.when}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">What happens</dt>
                <dd className="mt-1 text-ink">{lane.then}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">What the employee sees</dt>
                <dd className="mt-1 text-ink">{lane.employee}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-12 max-w-4xl">
          <h3 className="text-xl font-semibold text-ink">13 hard stops that block auto-pay</h3>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">
            A low risk score can&rsquo;t override any of these:{" "}
            {HARD_STOPS.map((s, i) => (
              <span key={s}>
                <span className="text-ink">{s}</span>
                {i < HARD_STOPS.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
