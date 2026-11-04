"use client";

import { motion } from "framer-motion";
import { TrendingUp, FileSearch, GitCompareArrows, Hourglass } from "lucide-react";
import { revealGroup, revealItem, revealViewport } from "./motion";

const PROBLEMS = [
  {
    icon: TrendingUp,
    title: "More staff, same process",
    body: "Claims grow with headcount, but each one is still checked by hand, one policy lookup at a time.",
  },
  {
    icon: FileSearch,
    title: "Manual review burden",
    body: "HR spends hours re-typing receipt amounts and looking up rules instead of on the cases that need judgment.",
  },
  {
    icon: GitCompareArrows,
    title: "Inconsistent decisions",
    body: "Two reviewers can read the same policy and reach different answers on the same claim.",
  },
  {
    icon: Hourglass,
    title: "Slow, unclear turnaround",
    body: "Employees wait to get paid and chase HR for updates. HR chases employees for missing receipts.",
  },
];

export default function ProblemSection() {
  return (
    <section
      id="problem"
      className="relative py-14 lg:py-20 px-5 sm:px-8 lg:px-12 bg-paper"
    >
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="max-w-2xl"
          variants={revealItem}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <span className="inline-flex items-center rounded-full border border-danger/20 bg-danger-soft/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-danger">
            The Problem
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink">
            Every claim gets the same slow, manual check.
          </h2>
          <p className="mt-4 text-ink-muted text-base sm:text-lg leading-relaxed">
            A MYR 15 lunch and a MYR 8,000 trip go through the same loop: open the attachment,
            read the amounts, find the rule in a policy PDF, write a reply.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={revealGroup}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          {PROBLEMS.map(({ icon: Icon, title, body }) => (
            <motion.div
              key={title}
              variants={revealItem}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative overflow-hidden rounded-2xl bg-surface p-6 transition-shadow duration-300 group"
            >
              <div
                aria-hidden="true"
                className="absolute -top-10 -right-10 w-36 h-36 rounded-bl-full bg-danger-soft/30 group-hover:scale-110 transition-transform duration-500"
              />
              <div className="relative z-10">
                <motion.div
                  className="inline-flex p-3 rounded-xl bg-danger-soft/40 text-danger mb-5"
                  whileHover={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </motion.div>
                <h3 className="font-display text-lg font-bold text-ink mb-2">
                  {title}
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {body}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
