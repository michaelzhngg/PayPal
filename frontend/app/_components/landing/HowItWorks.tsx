"use client";

import { motion } from "framer-motion";
import { ChevronRight, FileCheck2, ReceiptText, Scale, Wallet } from "lucide-react";
import { revealGroup, revealItem, revealViewport } from "./motion";

const STEPS = [
  {
    icon: ReceiptText,
    badge: "Step 1",
    name: "Snap the receipt",
    tagline: "Up to 10 receipts per claim",
    description:
      "The employee uploads photos or PDFs. AI reads the merchant, date, amount and category, and the employee checks the result.",
    points: ["JPEG, PNG or PDF", "Every edit to an AI-read field is logged"],
  },
  {
    icon: FileCheck2,
    badge: "Step 2",
    name: "AI checks it against policy",
    tagline: "Your policy, not a generic rulebook",
    description:
      "HR uploads the company policy once. The agent checks each receipt against its categories, caps and required conditions, and looks for signs of a fake receipt.",
    points: ["Eligible categories", "Spending caps", "Required conditions"],
  },
  {
    icon: Scale,
    badge: "Step 3",
    name: "Guardrails decide",
    tagline: "Fixed rules, separate from the AI",
    description:
      "Each claim gets a risk score. Clean, low-risk claims inside every limit are cleared to pay. Anything risky goes to HR, and the riskiest need two HR approvals.",
    points: ["Auto-pay", "Quick HR approval", "HR review", "Two-person review"],
  },
  {
    icon: Wallet,
    badge: "Step 4",
    name: "PayPal pays",
    tagline: "Sent with PayPal Payouts",
    description:
      "Approved claims are paid to the employee's verified PayPal account in under a minute. Each payout is sent once and recorded in the log.",
    points: ["Verified PayPal accounts only", "No payout is sent twice", "Every payout in a tamper-evident log"],
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative py-14 lg:py-20 px-5 sm:px-8 lg:px-12 bg-surface-muted overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-accent opacity-[0.05] blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-20 w-[420px] h-[420px] rounded-full bg-accent opacity-[0.06] blur-[120px]"
      />

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          className="max-w-2xl"
          variants={revealItem}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <span className="inline-flex items-center rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            How it works
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink">
            Four steps from receipt to payout.
          </h2>
          <p className="mt-4 text-ink-muted text-base sm:text-lg leading-relaxed">
            The AI reads and checks. Fixed rules decide whether money moves. A person decides anything risky.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 xl:gap-8 items-stretch"
          variants={revealGroup}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          {STEPS.map((p, idx) => (
            <motion.div key={p.name} className="relative flex" variants={revealItem}>
              <motion.div
                className="bg-paper border border-line relative flex-1 rounded-3xl p-7 border border-white/50 transition-shadow duration-300"
                whileHover={{ y: -5, transition: { duration: 0.25 } }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <motion.div
                    className="inline-flex p-3 rounded-xl bg-accent/10 text-accent"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <p.icon className="w-5 h-5" strokeWidth={2} />
                  </motion.div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                    {p.badge}
                  </span>
                </div>
                <h3 className="font-display text-xl xl:text-2xl font-bold text-ink">
                  {p.name}
                </h3>
                <p className="mt-1 text-sm font-semibold text-accent">
                  {p.tagline}
                </p>
                <p className="mt-4 text-sm text-ink-muted leading-relaxed">
                  {p.description}
                </p>

                <ul className="mt-5 space-y-2">
                  {p.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-ink">
                      <ChevronRight className="w-3.5 h-3.5 text-accent mt-1 shrink-0" aria-hidden="true" />
                      <span className="break-words">{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {idx < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className="hidden xl:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 items-center justify-center"
                >
                  <div className="w-9 h-9 rounded-full bg-accent text-on-accent flex items-center justify-center">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
