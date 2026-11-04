"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  FileSliders,
  History,
  Settings,
  LifeBuoy,
  LogOut,
  Plus,
  Users,
  Banknote,
  Gauge,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/hr/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hr/policy",    label: "Policy Studio",  icon: FileSliders         },
  { href: "/hr/manage_employee", label: "Manage Employee", icon: Users },
  { href: "/hr/history",   label: "History",    icon: History          },
  { href: "/hr/payouts",   label: "Payouts",    icon: Banknote         },
  { href: "/hr/autonomy",  label: "Autonomy",   icon: Gauge            },
  { href: "/hr/settings",  label: "Settings",   icon: Settings         },
];

export default function SideNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav
      aria-label="Desktop sidebar"
      className="hidden lg:flex flex-col w-64 shrink-0 h-screen bg-surface-muted border-r border-line/10"
    >
      <div className="flex flex-col h-full p-4">

        {/* ── Brand ─────────────────────────────────── */}
        <div className="px-4 py-5 mb-3">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.svg" alt="Reclaim Logo" width={28} height={28} className="w-7 h-7 object-contain" />
            <h1 className="font-display font-bold text-xl text-accent">
              Reclaim Pay
            </h1>
          </div>
          <p className="font-body text-xs font-medium text-ink-muted mt-1.5 leading-tight">
            HR Portal
          </p>
        </div>

        {/* ── Navigation Links ──────────────────────── */}
        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm transition-all duration-200 hover:active:scale-[0.97] ${
                  isActive
                    ? "bg-surface-muted font-bold text-accent"
                    : "font-medium text-ink hover:bg-surface-muted/60 hover:text-ink"
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                    isActive ? "text-accent" : "text-ink-muted"
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                {label}
              </Link>
            );
          })}
        </div>

        {/* ── Bottom: User + Utility ────────────────── */}
        <div className="mt-auto pt-4 border-t border-line/10">
          {/* User identity chip */}
          <div className="flex items-center gap-3 px-4 py-3 mb-1 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-accent-soft to-accent-soft shrink-0 flex items-center justify-center font-display font-bold text-sm text-accent-hover border-2 border-surface">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body font-semibold text-sm text-ink truncate leading-tight">
                {user?.name ?? "Employee"}
              </p>
              <p className="font-body text-[11px] text-ink-muted truncate">
                {user?.department_name ?? "General"}
              </p>
            </div>
          </div>

          <Link
            href="/hr/support"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm transition-all duration-200 hover:translate-x-0.5 active:scale-[0.97] ${
              pathname.startsWith("/hr/support")
                ? "bg-surface-muted font-bold text-accent"
                : "font-medium text-ink hover:bg-surface-muted/50"
            }`}
          >
            <LifeBuoy
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                pathname.startsWith("/hr/support") ? "text-accent" : "text-ink-muted"
              }`}
              strokeWidth={pathname.startsWith("/hr/support") ? 2.5 : 1.75}
            />
            Support
          </Link>

          <button
            id="sidenav-logout-btn"
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-body text-sm font-medium text-ink hover:bg-danger/10 hover:text-danger group transition-all hover:translate-x-0.5 active:scale-[0.97] cursor-pointer"
          >
            <LogOut
              className="w-[18px] h-[18px] text-ink-muted group-hover:text-danger transition-colors"
              strokeWidth={1.75}
            />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
