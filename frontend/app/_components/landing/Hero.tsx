"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { User } from "@/lib/api/types";
import { revealGroup, revealItem } from "./motion";

export default function Hero({ user }: { user: User | null }) {
  const dashHref = user?.role === "HR" ? "/hr/dashboard" : "/employee/dashboard";

  return (
    <section className="relative bg-ink overflow-hidden">

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-12 items-center">
          <motion.div
            className="max-w-3xl text-on-accent"
            variants={revealGroup}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={revealItem} className="flex items-center gap-3 sm:gap-4">
              <Image
                src="/images/logo.svg"
                alt=""
                width={64}
                height={64}
                className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-contain brightness-0 invert"
                priority
              />
              <span className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold">
                Reclaim Pay.
              </span>
            </motion.div>

            <motion.h1
              variants={revealItem}
              className="mt-6 font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1]"
            >
              Expense claims paid to PayPal in under a minute, when every check passes
            </motion.h1>

            <motion.p
              variants={revealItem}
              className="mt-6 max-w-2xl text-base sm:text-lg opacity-90 font-light leading-relaxed"
            >
              An AI agent checks each claim against your policy. Clean, low-risk claims go
              straight to the employee&rsquo;s PayPal account in under a minute. Everything else goes
              to HR with the evidence attached.
            </motion.p>

            <motion.p
              variants={revealItem}
              className="mt-5 font-display text-lg sm:text-xl font-bold"
            >
              Automation where it&rsquo;s safe, judgment where it matters.
            </motion.p>

            <motion.div variants={revealItem} className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login?demo=employee"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-on-accent text-accent rounded-full text-base font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
              >
                Try the live demo
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3.5 border border-white/40 text-on-accent rounded-full text-base font-semibold hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
              >
                How it works
                <ChevronDown className="w-4 h-4" />
              </a>
              {user && (
                <Link
                  href={dashHref}
                  className="inline-flex items-center gap-2 px-5 py-3 text-on-accent text-sm font-semibold underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
                >
                  Signed in? Go to your dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </motion.div>

            <div className="mt-10 lg:hidden">
              <Image
                src="/landing/s1_ride.jpg"
                alt="The S1 demo taxi receipt from Lintas Teksi Bandar, total RM 48.00"
                width={720}
                height={1066}
                className="w-full max-w-xs mx-auto h-auto rounded-card"
                priority
              />
            </div>
          </motion.div>

          <motion.div
            className="hidden lg:block flex-shrink-0"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          >
            <Image
              src="/landing/s1_ride.jpg"
              alt="The S1 demo taxi receipt from Lintas Teksi Bandar, total RM 48.00"
              width={720}
              height={1066}
              className="h-[620px] w-auto rounded-card"
              priority
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
