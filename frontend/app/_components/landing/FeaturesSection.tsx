"use client";

import { motion } from "framer-motion";
import { Handshake, LayoutList, ScanSearch, ShieldAlert } from "lucide-react";
import { revealGroup, revealItem, revealViewport } from "./motion";

// Receipt Shield is the flagship check, so it spans the full row and lists
// what it catches. The other three cards share the row below.
const FEATURES: {
  icon: typeof ScanSearch;
  title: string;
  body: string;
  points?: string[];
  span: string;
}[] = [
  {
    icon: ScanSearch,
    title: "Receipt Shield",
    body: "Every receipt is checked for signs it was faked or reused before any money moves. A hit sends the claim to HR, never straight to a rejection.",
    points: [
      "Hidden instructions written into the receipt",
      "Duplicates of an earlier claim",
      "AI-generated images",
      "Totals that don't add up",
      "One expense split into smaller claims",
    ],
    span: "md:col-span-2 lg:col-span-3",
  },
  {
    icon: ShieldAlert,
    title: "The Fraud Trap",
    body: "Every employee edit to an AI-read field is logged with a risk level. HR sees the AI value and the submitted value side by side.",
    span: "",
  },
  {
    icon: LayoutList,
    title: "Claims sorted for HR",
    body: "Claims that need a person arrive sorted by risk, with the reasons and the evidence attached. HR starts with the riskiest.",
    span: "",
  },
  {
    icon: Handshake,
    title: "Fair by design",
    body: "The AI never rejects a claim on its own. A person makes every risky call, and employees get a dispute window before any money is recovered.",
    span: "md:col-span-2 lg:col-span-1",
  },
];

export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative py-14 lg:py-20 px-5 sm:px-8 lg:px-12 bg-surface"
    >
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="max-w-2xl"
          variants={revealItem}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <span className="inline-flex items-center rounded-full border border-tertiary/20 bg-tertiary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-tertiary">
            Core Features
          </span>
          <h2 className="mt-4 font-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight">
            Built around accountability.
          </h2>
          <p className="mt-4 text-on-surface-variant text-base sm:text-lg leading-relaxed">
            Reclaim Pay pays the easy claims and hands the hard ones to people. Every flag comes with a reason HR can read.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6"
          variants={revealGroup}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          {FEATURES.map(({ icon: Icon, title, body, points, span }) => (
            <motion.div
              key={title}
              variants={revealItem}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`${span} relative overflow-hidden rounded-3xl bg-surface-container-lowest p-7 lg:p-8 shadow-ambient hover:shadow-ambient-lg transition-shadow duration-300 group`}
            >
              <div
                aria-hidden="true"
                className="absolute -top-12 -right-12 w-44 h-44 rounded-bl-full bg-gradient-to-br from-primary/15 to-tertiary/10 group-hover:scale-110 transition-transform duration-500"
              />
              <div className="relative z-10">
                <motion.div
                  className="inline-flex p-3.5 rounded-2xl bg-primary/10 text-primary mb-5"
                  whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
                >
                  <Icon className="w-6 h-6" strokeWidth={2} />
                </motion.div>
                <h3 className="font-headline text-xl lg:text-2xl font-bold text-on-surface tracking-tight mb-3">
                  {title}
                </h3>
                <p className="max-w-3xl text-sm lg:text-base text-on-surface-variant leading-relaxed">
                  {body}
                </p>
                {points && (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {points.map((point) => (
                      <li
                        key={point}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-on-surface"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
