import Image from "next/image";

// Only tools the product really uses (UI-REVAMP-HANDOFF, WP4 "Built with").
const BUILT_WITH = [
  "PayPal Payouts",
  "Log in with PayPal",
  "PayPal Agent Toolkit",
  "PayPal Server SDK",
  "Google Gemini",
  "AG Grid",
  "AG Charts",
  "Bryntum",
  "Postman",
];

const REPO = "https://github.com/michaelzhngg/PayPal";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <section aria-labelledby="built-with-heading" className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12">
        <h2 id="built-with-heading" className="font-body text-sm font-semibold text-ink">
          Built with
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-base text-ink-muted">
          {BUILT_WITH.map((tool, i) => (
            <li key={tool}>
              {tool}
              {i < BUILT_WITH.length - 1 && (
                <span aria-hidden="true" className="ml-2 text-line-strong">
                  /
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p className="flex items-center gap-2">
            <Image src="/images/logo.svg" alt="" width={20} height={20} className="h-5 w-5" />
            <span>
              <span className="font-semibold text-ink">Reclaim Pay</span> by Team Bogosort. All payments use the PayPal sandbox.
            </span>
          </p>
          <ul className="flex flex-wrap gap-x-5">
            <li>
              <a href={REPO} className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:decoration-2">
                Source on GitHub
              </a>
            </li>
            <li>
              <a href={`${REPO}/blob/main/LICENSE`} className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:decoration-2">
                AGPL-3.0
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
