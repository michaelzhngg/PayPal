"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Check, UserCircle2, Users } from "lucide-react";
import { revealGroup, revealItem, revealViewport } from "./motion";

const HR_ITEMS = [
  "Policy Studio: upload, edit and review company policy",
  "Risky claims arrive sorted, with the evidence attached",
  "Clean, low-risk claims are paid without waiting on you",
  "A full audit trail for every claim and payout",
];

const EMP_ITEMS = [
  "Upload up to 10 receipts (JPEG, PNG, PDF) per claim",
  "Check what the AI read, and fix it if it's wrong",
  "Clean claims are paid to your PayPal account in seconds",
  "Live claim status, so you don't have to chase HR",
];

export default function ForWhomSection() {
  return (
    <section className="relative py-14 lg:py-20 px-5 sm:px-8 lg:px-12 bg-surface-container-low">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="max-w-2xl mb-10"
          variants={revealItem}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <span className="inline-flex items-center rounded-full border border-on-surface-variant/20 bg-surface-container-lowest px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Two portals
          </span>
          <h2 className="mt-4 font-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight">
            Built for both sides of the desk.
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          variants={revealGroup}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <motion.div
            variants={revealItem}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            className="relative overflow-hidden rounded-3xl bg-surface-container-lowest p-8 lg:p-10 shadow-ambient hover:shadow-ambient-lg transition-shadow duration-300"
          >
            <div
              aria-hidden="true"
              className="absolute -top-12 -right-12 w-44 h-44 rounded-bl-full bg-primary/10"
            />
            <div className="relative z-10">
              <motion.div
                className="inline-flex p-3.5 rounded-2xl bg-primary/10 text-primary mb-5"
                whileHover={{ scale: 1.1, rotate: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Users className="w-6 h-6" strokeWidth={2} />
              </motion.div>
              <h3 className="font-headline text-2xl font-bold text-on-surface tracking-tight mb-2">
                For HR teams
              </h3>
              <p className="text-sm text-on-surface-variant mb-5">
                Set the policy, then decide the claims that need a person.
              </p>
              <ul className="space-y-3 mb-7">
                {HR_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-on-surface">
                    <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-primary/15 text-primary items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login?role=hr"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dim transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
              >
                Open HR Portal
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            variants={revealItem}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            className="relative overflow-hidden rounded-3xl bg-surface-container-lowest p-8 lg:p-10 shadow-ambient hover:shadow-ambient-lg transition-shadow duration-300"
          >
            <div
              aria-hidden="true"
              className="absolute -top-12 -right-12 w-44 h-44 rounded-bl-full bg-tertiary/10"
            />
            <div className="relative z-10">
              <motion.div
                className="inline-flex p-3.5 rounded-2xl bg-tertiary/10 text-tertiary mb-5"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <UserCircle2 className="w-6 h-6" strokeWidth={2} />
              </motion.div>
              <h3 className="font-headline text-2xl font-bold text-on-surface tracking-tight mb-2">
                For employees
              </h3>
              <p className="text-sm text-on-surface-variant mb-5">
                Submit claims, check what the AI read, and get paid to PayPal.
              </p>
              <ul className="space-y-3 mb-7">
                {EMP_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-on-surface">
                    <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-tertiary/15 text-tertiary items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login?role=employee"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-tertiary hover:text-tertiary-dim transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/40 rounded"
              >
                Open Employee Portal
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
