"use client";

import { motion } from "framer-motion";
import { revealGroup, revealItem, revealViewport } from "./motion";

// The safety controls the payout agent runs under. Plain descriptions only:
// no figures here unless they are fixed product rules.
const CONTROLS = [
  {
    title: "Verified PayPal accounts",
    body: "Money goes only to a PayPal account the employee connected and verified.",
  },
  {
    title: "72-hour pause after a change",
    body: "When an employee changes their PayPal account, automatic payouts to them stop for 72 hours. HR can still approve by hand.",
  },
  {
    title: "Spending limits",
    body: "Each employee has a payout limit, plus daily and monthly caps and a company daily budget. Anything over a limit waits for HR.",
  },
  {
    title: "Two-person approval",
    body: "The riskiest claims need approval from two different HR members before any money moves.",
  },
  {
    title: "Circuit breaker and kill switch",
    body: "Automatic payouts pause on their own if too many recent claims look risky. HR can also switch them off at once.",
  },
  {
    title: "Tamper-evident log",
    body: "Every agent action is written to a chained log, so a later edit to the record shows.",
  },
];

export default function StatsBand() {
  return (
    <section id="safety" className="relative bg-ink overflow-hidden">

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 py-14 lg:py-20">
        <motion.div
          className="max-w-2xl text-on-accent mb-10"
          variants={revealItem}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <span className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
            Safety controls
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-bold">
            Bounded by design.
          </h2>
          <p className="mt-4 text-base lg:text-lg opacity-90 leading-relaxed">
            The agent moves money only inside limits the company sets. These controls are fixed
            rules, separate from the AI.
          </p>
        </motion.div>

        <motion.ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 text-on-accent"
          variants={revealGroup}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          {CONTROLS.map((c) => (
            <motion.li key={c.title} variants={revealItem} className="border-l-2 border-white/30 pl-5">
              <h3 className="font-display text-lg lg:text-xl font-bold">
                {c.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed opacity-90">{c.body}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
