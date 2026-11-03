"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

const PRODUCT_LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#safety", label: "Safety" },
  { href: "#demo", label: "Demo" },
];

export default function Footer() {
  return (
    <footer className="bg-inverse-surface text-on-primary px-5 sm:px-8 lg:px-12 pt-16 pb-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="md:col-span-2 md:pr-8">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/logo.svg"
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 object-contain brightness-0 invert"
              />
              <span className="font-headline text-2xl font-black tracking-tighter">
                Reclaim Pay<span className="text-primary-fixed-dim">.</span>
              </span>
            </div>
            <p className="mt-4 text-sm opacity-80 max-w-md leading-relaxed">
              Expense claims paid to PayPal when it&rsquo;s safe, and sent to HR with the evidence when it isn&rsquo;t. Automation where it&rsquo;s safe, judgment where it matters.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.18em] opacity-70 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-sm opacity-90 hover:opacity-100 hover:text-primary-fixed-dim transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="text-sm opacity-90 hover:opacity-100 hover:text-primary-fixed-dim transition-colors"
                >
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs opacity-70 text-center sm:text-left">
            Reclaim Pay · Built for the PayPal AI Hackathon 2026
          </p>
          <a
            href="https://github.com/michaelzhngg/PayPal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity"
          >
            <ExternalLink className="w-4 h-4" />
            View on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
