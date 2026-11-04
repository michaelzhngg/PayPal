import Image from "next/image";
import { Check } from "lucide-react";
import s1Receipt from "@/public/landing/s1_ride.jpg";

// Real S1 data (demo/README.md, scenario S1, and the 4 Nov live run).
const FIELDS = [
  { label: "Merchant", value: "LINTAS TEKSI BANDAR" },
  { label: "Date", value: "03/11/2026" },
  { label: "Category", value: "Transportation" },
  { label: "Amount", value: "MYR 48.00" },
];

// The six Receipt Shield checks (README, "Stopping fake receipts").
const CHECKS = [
  "Hidden instructions",
  "Duplicate receipts",
  "AI-generated image",
  "Totals add up",
  "Split claims",
  "Edited amounts",
];

/*
 * The HTML below is the finished end state of the scene. LandingMotion pins it
 * on wide screens and lets scroll position play the claim from receipt to
 * payout; on phones the groups appear one after another; with reduced motion
 * nothing moves.
 */
export default function ClaimScene() {
  return (
    <section id="how-it-works" aria-labelledby="claim-heading" data-scene="claim" className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-8 lg:px-12 lg:pt-24">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <h2 id="claim-heading" className="text-3xl font-semibold leading-tight text-ink sm:text-[2.75rem]">
            The 40 seconds of a claim
          </h2>
          <p className="max-w-md text-base leading-relaxed text-ink-muted md:justify-self-end">
            Demo claim S1 as it ran live on 4 Nov: about 40 s from submit to paid, with no person
            involved.
          </p>
        </div>
      </div>

      <div data-stage className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-8 md:flex md:min-h-[min(calc(100svh-4rem),52rem)] md:items-center lg:px-12 lg:pb-24">
        <div className="grid w-full gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
          <figure data-step="receipt" className="relative mx-auto w-full max-w-[240px] md:max-w-[340px]">
            <div className="relative overflow-hidden rounded-card">
              <Image
                src={s1Receipt}
                alt="The S1 taxi receipt being read"
                width={720}
                height={1066}
                sizes="(min-width: 768px) 340px, 240px"
                className="h-auto w-full"
              />
              <span
                data-scan
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 bg-ink opacity-0"
              />
            </div>
          </figure>

          <ol className="receipt-paper rounded-card border border-line p-5 sm:p-7">
            <li data-step="read">
              <StepTitle n="01" title="Read the receipt" />
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
                {FIELDS.map((f) => (
                  <div key={f.label} data-row className="contents">
                    <dt className="text-ink-muted">{f.label}</dt>
                    <dd className="truncate text-right font-mono text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </li>

            <li aria-hidden="true" className="perforated my-5 list-none" />

            <li data-step="checks">
              <StepTitle n="02" title="Run six fixed checks" />
              <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {CHECKS.map((c) => (
                  <li key={c} data-row className="flex items-center gap-2 text-ink">
                    <Check data-tick className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span>{c}</span>
                    <span className="sr-only">: clear</span>
                  </li>
                ))}
              </ul>
            </li>

            <li aria-hidden="true" className="perforated my-5 list-none" />

            <li data-step="lane">
              <StepTitle n="03" title="Pick the lane" />
              <p className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-display text-xl font-semibold text-ink">Auto-pay</span>
                <span className="font-mono text-ink-muted">risk 0, no hard stop</span>
              </p>
            </li>

            <li aria-hidden="true" className="perforated my-5 list-none" />

            <li data-step="paid">
              <StepTitle n="04" title="Pay" />
              <p className="mt-3 rounded-control bg-success-soft px-4 py-3">
                <span className="block font-mono text-lg font-medium text-success sm:text-xl">
                  MYR 48.00 in your PayPal
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  The employee&rsquo;s verified PayPal sandbox account, about 40 s after submit
                </span>
              </p>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepTitle({ n, title }: { n: string; title: string }) {
  return (
    <h3 className="flex items-baseline gap-3 font-body text-sm font-semibold text-ink">
      <span className="font-mono text-xs font-normal text-ink-muted">{n}</span>
      {title}
    </h3>
  );
}
