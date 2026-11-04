"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@/lib/api/types";

// Only sections that exist on this page.
const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#lanes", label: "Lanes" },
  { href: "#safety", label: "Safety" },
  { href: "#try", label: "Try it" },
];

export default function Header({ user }: { user: User | null }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const signInHref = user ? (user.role === "HR" ? "/hr/dashboard" : "/employee/dashboard") : "/login";
  const signInLabel = user ? "Your dashboard" : "Sign in";

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-paper transition-colors duration-200 ${
        scrolled ? "border-line" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-control">
          <Image src="/images/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-display text-xl font-semibold text-ink">Reclaim Pay</span>
        </Link>

        <nav className="hidden md:block" aria-label="Page sections">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href={signInHref}
          className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted"
        >
          {signInLabel}
        </Link>
      </div>
    </header>
  );
}
