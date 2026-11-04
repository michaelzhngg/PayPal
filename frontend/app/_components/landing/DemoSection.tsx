"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { revealGroup, revealItem, revealViewport } from "./motion";

interface DemoAccount {
  role: "HR" | "Employee";
  slug: "hr" | "employee";
  email: string;
  password: string;
  description: string;
  iconBg: string;
  iconText: string;
}

const ACCOUNTS: DemoAccount[] = [
  {
    role: "HR",
    slug: "hr",
    email: "hr@example.com",
    password: "password",
    description: "Review risky claims with the evidence, and track every payout.",
    iconBg: "bg-accent/10",
    iconText: "text-accent",
  },
  {
    role: "Employee",
    slug: "employee",
    email: "employee@example.com",
    password: "password",
    description: "Submit a multi-receipt claim, check what the AI read, and watch it get decided.",
    iconBg: "bg-accent/10",
    iconText: "text-accent",
  },
];

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (older browsers): do nothing.
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-line-strong/15 bg-paper px-4 py-3 text-left font-mono text-sm text-ink hover:border-accent/40 hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/60"
    >
      <span className="truncate">{value}</span>
      <span
        className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold ${
          copied
            ? "text-accent"
            : "text-ink-muted group-hover:text-accent"
        }`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

export default function DemoSection() {
  return (
    <section
      id="demo"
      className="relative py-14 lg:py-20 px-5 sm:px-8 lg:px-12 bg-paper overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(70,71,211,0.08),transparent_60%)] pointer-events-none"
      />

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          className="max-w-2xl"
          variants={revealItem}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            <KeyRound className="w-3 h-3" />
            Try the demo
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink">
            One click. You&rsquo;re inside.
          </h2>
          <p className="mt-4 text-ink-muted text-base sm:text-lg leading-relaxed">
            Pick a role and we&rsquo;ll sign you in with sample data. No setup and no typing.
            The credentials are below if you&rsquo;d rather copy them.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6"
          variants={revealGroup}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
        >
          {ACCOUNTS.map((acc) => (
            <motion.div
              key={acc.role}
              variants={revealItem}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="bg-paper border border-line relative overflow-hidden rounded-3xl border border-white/50 p-7 lg:p-8 transition-shadow duration-300"
            >
              <div className="flex items-center gap-3 mb-5">
                <motion.div
                  className={`inline-flex p-3 rounded-xl ${acc.iconBg} ${acc.iconText}`}
                  whileHover={{ scale: 1.1, rotate: acc.role === "HR" ? -5 : 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <ShieldCheck className="w-5 h-5" strokeWidth={2} />
                </motion.div>
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    {acc.role} Demo
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {acc.description}
                  </p>
                </div>
              </div>

              <Link
                href={`/login?demo=${acc.slug}`}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-accent to-accent-hover active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
              >
                Sign in as {acc.role}
                <ArrowRight className="w-4 h-4" />
              </Link>

              <details className="mt-5 group">
                <summary className="cursor-pointer text-xs font-semibold text-ink-muted hover:text-ink transition-colors list-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 rounded">
                  <span className="inline-block transition-transform group-open:rotate-90">›</span>
                  Or copy credentials
                </summary>
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted mb-1.5">
                      Email
                    </label>
                    <CopyField value={acc.email} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted mb-1.5">
                      Password
                    </label>
                    <CopyField value={acc.password} />
                  </div>
                </div>
              </details>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-8 text-center text-xs text-ink-muted max-w-xl mx-auto">
          Demo accounts with sample data. Other visitors use them too.
        </p>
      </div>
    </section>
  );
}
