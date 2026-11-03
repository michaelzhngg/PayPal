"use client";

import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { Settings, User, Wallet, ChevronRight, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import PayPalConnectCard from "./_components/PayPalConnectCard";
import ProfileCard from "./_components/ProfileCard";

// The URL hash picks the section, so /employee/settings#paypal opens on PayPal.
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash;
const readServerHash = () => "";

const SECTIONS = [
  { id: "paypal", label: "PayPal Payouts", icon: Wallet },
  { id: "profile", label: "Profile Information", icon: User },
] as const;

export default function SettingsLegacyContent() {
  const { user } = useAuth();
  const hash = useSyncExternalStore(subscribeHash, readHash, readServerHash);
  const active = hash === "#profile" ? "profile" : "paypal";
  const paypalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hash !== "#paypal") return;
    const el = paypalRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }, [hash]);

  return (
    <div className="relative min-h-full p-6 md:p-10 lg:p-12">
      {/* Ambient glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[480px] h-[480px] rounded-full bg-primary opacity-[0.07] blur-[80px]" />
        <div className="absolute top-32 right-40 w-[320px] h-[320px] rounded-full bg-tertiary opacity-[0.06] blur-[64px]" />
        <div className="absolute -top-8 right-[15%] w-[200px] h-[200px] rounded-full bg-primary-container opacity-[0.12] blur-[48px]" />
      </div>

      <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Settings className="w-5 h-5" />
              <span className="font-label font-bold tracking-widest uppercase text-xs">Preferences</span>
            </div>
            <h2
              className="font-headline font-extrabold text-on-background mb-2 tracking-tight"
              style={{ fontSize: "2.5rem", letterSpacing: "-0.02em" }}
            >
              Settings
            </h2>
            <p className="text-on-surface-variant text-lg font-body">
              Manage your account preferences and the PayPal account your reimbursements are paid to.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* ── Left Sidebar (Desktop Nav) ── */}
          <div className="hidden md:flex flex-col gap-2">
            {SECTIONS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={active === item.id ? "true" : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                  active === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
                }`}
              >
                <item.icon className="w-4 h-4" aria-hidden />
                {item.label}
              </a>
            ))}
            <Link
              href="/employee/support"
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm font-semibold transition-colors text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
            >
              <LifeBuoy className="w-4 h-4" aria-hidden />
              Help & Support
            </Link>
          </div>

          {/* ── Main Content Area ── */}
          <div className="md:col-span-2 space-y-6">

            {/* PayPal first: it decides whether reimbursements can reach the employee */}
            <div
              id="paypal"
              ref={paypalRef}
              tabIndex={-1}
              className={`scroll-mt-24 rounded-2xl outline-none transition-shadow ${
                hash === "#paypal" ? "ring-2 ring-primary/50 ring-offset-2 ring-offset-surface" : ""
              }`}
            >
              <Suspense>
                <PayPalConnectCard />
              </Suspense>
            </div>

            <ProfileCard key={user?.user_id ?? "anon"} />

            {/* Mobile Support Link */}
            <section className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden shadow-sm md:hidden block">
              <div className="p-6">
                <Link href="/employee/support" className="flex items-center justify-between p-4 border border-outline-variant/20 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-tertiary-container text-on-tertiary-container rounded-lg">
                      <LifeBuoy className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-headline font-bold text-sm text-on-surface">Help & Support</p>
                      <p className="font-body text-xs text-on-surface-variant">Access FAQs or contact HR</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
