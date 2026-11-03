"use client";

import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { Settings, User, Wallet, ChevronRight, Save, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import PayPalConnectCard from "./_components/PayPalConnectCard";

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

            {/* Profile Section */}
            <section id="profile" className="scroll-mt-24 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-outline-variant/10">
                <h2 className="font-headline font-bold text-lg text-on-surface mb-1">Profile Information</h2>
                <p className="font-body text-sm text-on-surface-variant">Update your personal details below.</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-primary-container to-tertiary-container shadow-sm border-2 border-surface flex items-center justify-center font-headline font-bold text-xl text-on-primary-container">
                    {user?.name?.charAt(0) || "E"}
                  </div>
                  <button className="px-4 py-2 border border-outline-variant/20 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors">
                    Change Avatar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Full Name</label>
                    <input type="text" defaultValue={user?.name || "Employee"} className="w-full bg-surface-container text-on-surface px-4 py-2.5 rounded-xl border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Email Address</label>
                    <input type="email" defaultValue={user?.email || "employee@reclaim.inc"} className="w-full bg-surface-container text-on-surface px-4 py-2.5 rounded-xl border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-label text-xs font-bold text-on-surface-variant uppercase tracking-wider">Department</label>
                    <input type="text" defaultValue={user?.department_name || "General"} disabled className="w-full bg-surface-variant/30 text-on-surface-variant px-4 py-2.5 rounded-xl border border-transparent cursor-not-allowed" />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-surface-container/30 border-t border-outline-variant/10 flex justify-end">
                <button className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all">
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </section>

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
