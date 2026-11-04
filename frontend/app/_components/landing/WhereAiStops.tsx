import styles from "./landing.module.css";

// From README, "Where the AI stops". Drawn as a line diagram on wide screens and
// as an ordered list below 1024 px, where the diagram's text would be too small.

type Node = { id: string; x: number; y: number; w: number; h: number; title: string; lines: string[] };

const NODES: Node[] = [
  { id: "ai", x: 24, y: 60, w: 240, h: 120, title: "AI reads and advises", lines: ["Reads the receipt", "Checks it against policy"] },
  { id: "rules", x: 324, y: 60, w: 240, h: 120, title: "Fixed rules decide", lines: ["Receipt Shield checks", "decide() picks the lane"] },
  { id: "payout", x: 644, y: 60, w: 220, h: 120, title: "Payout service", lines: ["The only code that", "sends money"] },
  { id: "paypal", x: 924, y: 60, w: 190, h: 120, title: "PayPal Payouts", lines: ["Sandbox in this demo"] },
  { id: "hr", x: 484, y: 250, w: 260, h: 100, title: "HR reviews the evidence", lines: ["One or two approvals"] },
];

// Edges in reading order, each with its arrowhead.
const EDGES = [
  { d: "M264 120 H324", head: "316,115 324,120 316,125" },
  { d: "M564 120 H644", head: "636,115 644,120 636,125", label: { x: 604, y: 108, text: "Auto-pay", anchor: "middle" } },
  { d: "M864 120 H924", head: "916,115 924,120 916,125" },
  { d: "M444 180 V300 H484", head: "476,295 484,300 476,305", label: { x: 434, y: 246, text: "Any other lane", anchor: "end" } },
  { d: "M744 300 H754 V180", head: "749,188 754,180 759,188", label: { x: 764, y: 246, text: "Approved", anchor: "start" } },
] as const;

const STEPS = [
  { title: "AI reads and advises", body: "It reads the receipt and checks it against the policy. It has no access to the payout code." },
  { title: "Fixed rules decide", body: "The Receipt Shield checks run, then decide(), plain deterministic code, picks the lane. The AI's verdict can hold a claim back but can't force a payment." },
  { title: "HR reviews, when the lane says so", body: "Any lane other than auto-pay waits for one or two HR approvals." },
  { title: "Only the payout service sends money", body: "After auto-pay or the required approvals, to PayPal Payouts (sandbox in this demo)." },
];

export default function WhereAiStops() {
  return (
    <section aria-labelledby="stops-heading" data-scene="stops" className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="max-w-2xl">
          <h2 id="stops-heading" className="text-3xl font-semibold leading-tight text-ink sm:text-[2.75rem]">
            Where the AI stops
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            No path in the product lets the AI move money. It reads and advises; fixed rules and
            people decide.
          </p>
        </div>

        <svg
          data-diagram
          viewBox="0 0 1120 380"
          role="img"
          aria-labelledby="stops-svg-title"
          className="mt-12 hidden h-auto w-full lg:block"
        >
          <title id="stops-svg-title">
            AI reads and advises, fixed rules decide, auto-pay goes straight to the payout service,
            any other lane goes to HR first, and only the payout service sends money to PayPal
            Payouts.
          </title>
          <rect x="8" y="36" width="272" height="160" rx="16" fill="none" stroke="var(--color-line-strong)" strokeDasharray="5 5" />
          <text x="24" y="222" className="font-mono" fontSize="13" fill="var(--color-ink-muted)">
            No access to PayPal
          </text>

          {NODES.map((n) => (
            <g key={n.id} data-node>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="12" fill="var(--color-surface)" stroke="var(--color-line-strong)" />
              <text x={n.x + 18} y={n.y + 38} className="font-display" fontSize="19" fontWeight="600" fill="var(--color-ink)">
                {n.title}
              </text>
              {n.lines.map((l, i) => (
                <text key={l} x={n.x + 18} y={n.y + 66 + i * 22} fontSize="15" fill="var(--color-ink-muted)">
                  {l}
                </text>
              ))}
            </g>
          ))}

          {EDGES.map((e) => (
            <g key={e.d} data-edge>
              <path d={e.d} pathLength={1} strokeDasharray="1" strokeDashoffset="0" className={styles.edge} />
              <polygon data-head points={e.head} fill="var(--color-ink)" />
              {"label" in e && e.label ? (
                <text data-head x={e.label.x} y={e.label.y} textAnchor={e.label.anchor} className="font-mono" fontSize="13" fill="var(--color-ink)">
                  {e.label.text}
                </text>
              ) : null}
            </g>
          ))}
        </svg>

        <ol className="mt-10 border-l border-ink pl-6 lg:hidden">
          {STEPS.map((s, i) => (
            <li key={s.title} data-row className={i > 0 ? "mt-8" : ""}>
              <p className="font-mono text-xs text-ink-muted">0{i + 1}</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-ink-muted">
          The one AI step near a PayPal call is the recovery note, and that invoice goes out only
          after HR clicks send.
        </p>
      </div>
    </section>
  );
}
