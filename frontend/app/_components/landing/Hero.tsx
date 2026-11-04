import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./landing.module.css";
import s1Receipt from "@/public/landing/s1_ride.jpg";

// Server component: the headline is in the HTML and readable without JavaScript.
// It is one run of text that wraps on its own (no <br>), so the words can never
// run together at any width (F1). It rises once inside a mask on load (CSS only).
const HEADLINE = "Expense claims paid to PayPal in under a minute, when every check passes";

export default function Hero() {
  return (
    <section aria-labelledby="hero-heading">
      <div className="mx-auto grid max-w-7xl px-4 sm:px-8 lg:px-12 items-center gap-10 pb-16 pt-8 sm:pt-12 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12 lg:pb-24 lg:pt-16">
        <div className="max-w-[50rem]">
          <h1
            id="hero-heading"
            className={`${styles.line} text-balance text-[2.125rem] font-semibold leading-[1.08] text-ink sm:text-5xl lg:text-[3.75rem] xl:text-[4rem]`}
          >
            <span className={styles.lineInner}>{HEADLINE}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            The AI reads each receipt and checks it against your policy, then fixed rules decide
            whether it is paid now or goes to HR with the evidence.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/login?demo=employee"
              className="inline-flex min-h-12 items-center gap-2 rounded-control bg-accent px-6 text-base font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              Try the live demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-11 items-center rounded-control px-1 text-base font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
            >
              How it works
            </a>
          </div>
        </div>

        <figure className="mx-auto w-full max-w-[260px] sm:max-w-[320px] md:max-w-[340px] lg:max-w-[400px]">
          <span className={styles.settle}>
            <Image
              src={s1Receipt}
              alt="Taxi receipt from Lintas Teksi Bandar: trip fare 45.00 plus booking fee 3.00, total RM 48.00"
              width={720}
              height={1066}
              sizes="(min-width: 1024px) 400px, (min-width: 768px) 340px, 320px"
              preload
              loading="eager"
              fetchPriority="high"
              className="h-auto w-full rounded-card"
            />
          </span>
          <figcaption className="mt-3 font-mono text-xs text-ink-muted">
            Demo receipt S1, RM 48.00. Payouts use the PayPal sandbox.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
