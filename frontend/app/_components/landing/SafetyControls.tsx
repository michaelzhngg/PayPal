// The six controls the payout agent runs under. Every figure is a fixed product
// rule from README ("Paying safely with PayPal" and "HR stays in control").
const CONTROLS = [
  {
    title: "Verified PayPal accounts",
    body: "Money goes only to a PayPal account the employee connected through Log in with PayPal.",
  },
  {
    title: "72-hour pause after a change",
    body: "When an employee changes their PayPal account, instant payouts to them stop for 72 hours. HR can still approve by hand.",
  },
  {
    title: "Spending limits",
    body: "Instant-pay limits of RM50 for new staff, RM100 standard and RM200 trusted, an RM300 daily and RM1,000 monthly cap per person, and a company budget of RM2,000 a day. Anything over a limit waits for HR.",
  },
  {
    title: "Two-person approval",
    body: "The riskiest claims need two different HR members before any money moves, and HR can't approve their own claim.",
  },
  {
    title: "Circuit breaker and kill switch",
    body: "Auto-pay pauses for 60 minutes if 6 of the last 20 decisions are high-risk. HR can stop it at once, with a logged reason.",
  },
  {
    title: "Tamper-evident log",
    body: "Each agent action stores a hash of the previous one, so editing a past entry breaks the chain.",
  },
];

export default function SafetyControls() {
  return (
    <section id="safety" aria-labelledby="safety-heading" className="bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:px-12 lg:py-24">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="safety-heading" className="text-3xl font-semibold leading-tight sm:text-[2.75rem]">
            Six controls the agent can&rsquo;t switch off
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-paper/75">
            Fixed rules, separate from the AI. The agent moves money only inside them.
          </p>
        </div>

        <ol className="divide-y divide-paper/15 border-y border-paper/15">
          {CONTROLS.map((c, i) => (
            <li key={c.title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 py-6 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
              <span className="font-mono text-2xl text-paper/60 sm:text-4xl" aria-hidden="true">
                0{i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold sm:text-2xl">{c.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper/75 sm:text-base">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
