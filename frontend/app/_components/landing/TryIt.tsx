import Link from "next/link";
import CopyField from "./CopyField";
import s1Receipt from "@/public/landing/s1_ride.jpg";
import s4Receipt from "@/public/landing/s4_injection.jpg";

// One-click demo sign-in. The /login?demo=<slug> links are the ones the login
// page already understands; the accounts come from seeds/seed_reclaim_pay.py.
const ROLES = [
  {
    slug: "employee",
    role: "Employee",
    email: "employee@example.com",
    intro: "Submit a receipt and watch each check run until it is paid or sent to HR.",
    receipts: true,
  },
  {
    slug: "hr",
    role: "HR",
    email: "hr@example.com",
    intro: "Work the triage queue, read the evidence on a held claim, and change a limit on the Autonomy page to see the back-test.",
    receipts: false,
  },
] as const;

export default function TryIt() {
  return (
    <section id="try" aria-labelledby="try-heading" className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-12 lg:py-24">
        <h2 id="try-heading" className="max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-[2.75rem]">
          Sign in to the demo as an employee or as HR
        </h2>

        <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
          {ROLES.map((r, i) => (
            <div key={r.slug} className={i === 0 ? "md:pr-10 lg:pr-16" : "md:pl-10 lg:pl-16"}>
              <h3 className="text-2xl font-semibold text-ink">{r.role}</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-ink-muted">{r.intro}</p>

              {r.receipts && (
                <>
                  <ul className="mt-3 flex flex-wrap gap-x-5">
                    <li>
                      <a href={s1Receipt.src} download="s1_ride.jpg" className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:decoration-2">
                        Download receipt S1 (taxi)
                      </a>
                    </li>
                    <li>
                      <a href={s4Receipt.src} download="s4_injection.jpg" className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:decoration-2">
                        Download receipt S4 (lunch)
                      </a>
                    </li>
                  </ul>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
                    If someone uploaded S1 before you, yours is flagged as a duplicate, which is that
                    check doing its job.
                  </p>
                </>
              )}

              <Link
                href={`/login?demo=${r.slug}`}
                className="mt-6 inline-flex min-h-12 items-center rounded-control bg-ink px-6 text-base font-semibold text-paper transition-colors hover:bg-ink/85"
              >
                Sign in as {r.role === "HR" ? "HR" : "an employee"}
              </Link>

              <div className="mt-6 max-w-sm">
                <CopyField label="Email" value={r.email} />
                <CopyField label="Password" value="password" />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 text-sm text-ink-muted">
          Demo accounts with sample data. Other visitors use them too. Please leave the kill switch alone.
        </p>
      </div>
    </section>
  );
}
