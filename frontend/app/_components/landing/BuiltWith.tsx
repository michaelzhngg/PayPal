// This list must match what appears in the demo video and the Devpost "Built with"
// section. Only add a tool here once it is visible in the demo.
const BUILT_WITH = [
  "PayPal Payouts",
  "Log in with PayPal",
  "PayPal Invoicing",
  "Next.js",
  "FastAPI",
  "LangGraph",
  "PostgreSQL + pgvector",
  "AG Grid",
];

export default function BuiltWith() {
  return (
    <section
      aria-labelledby="built-with-heading"
      className="px-5 sm:px-8 lg:px-12 py-10 bg-surface-muted border-y border-line"
    >
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-10">
        <h2
          id="built-with-heading"
          className="shrink-0 font-display text-sm font-bold text-ink"
        >
          Built with
        </h2>
        <ul className="flex flex-wrap gap-2">
          {BUILT_WITH.map((tool) => (
            <li
              key={tool}
              className="rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-ink-muted"
            >
              {tool}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
