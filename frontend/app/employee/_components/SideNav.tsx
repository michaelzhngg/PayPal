"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  History,
  CalendarDays,
  ClipboardList,
  Settings,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { getDraftCount } from "@/lib/actions/claims";

const NAV_LINKS = [
  { href: "/employee/dashboard", label: "Dashboard",    icon: LayoutDashboard },
  { href: "/employee/claims",    label: "Upload Claim", icon: FileText         },
  { href: "/employee/history",   label: "History",      icon: History          },
  { href: "/employee/calendar",  label: "Calendar",     icon: CalendarDays     },
  { href: "/employee/drafts",    label: "Drafts",       icon: ClipboardList    },
  { href: "/employee/settings",  label: "Settings",     icon: Settings         },
];

export default function SideNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    getDraftCount().then(count => setDraftCount(count));
  }, [pathname]); // refresh on navigation

  return (
    <nav
      aria-label="Desktop sidebar"
      className="hidden lg:flex flex-col w-64 shrink-0 h-screen bg-surface border-r border-line"
    >
      <div className="flex flex-col h-full p-4">

        {/* ── Brand ─────────────────────────────────── */}
        <div className="px-4 py-5 mb-3">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.svg" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            <span className="font-display font-semibold text-xl text-ink">
              Reclaim Pay
            </span>
          </div>
          <p className="font-body text-xs font-medium text-ink-muted mt-1.5 leading-tight">
            Employee Portal
          </p>
        </div>

        {/* ── Navigation Links ──────────────────────── */}
        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            const isDrafts = label === "Drafts";
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-4 min-h-[44px] rounded-control font-body text-sm transition-colors ${
                  isActive
                    ? "bg-accent-soft font-semibold text-accent-hover"
                    : "font-medium text-ink hover:bg-surface-muted"
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                    isActive ? "text-accent-hover" : "text-ink-muted"
                  }`}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                {label}
                {isDrafts && draftCount > 0 && (
                  <span
                    aria-label={`${draftCount} drafts`}
                    className="ml-auto bg-ink text-on-accent font-mono text-[11px] font-medium min-w-5 h-5 px-1 rounded-full flex items-center justify-center"
                  >
                    {draftCount > 9 ? "9+" : draftCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Bottom: User + Utility ────────────────── */}
        <div className="mt-auto pt-4 border-t border-line">
          {/* User identity chip */}
          <div className="flex items-center gap-3 px-4 py-3 mb-1">
            <div aria-hidden="true" className="w-9 h-9 rounded-full bg-surface-muted border border-line shrink-0 flex items-center justify-center font-body font-semibold text-sm text-ink">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body font-semibold text-sm text-ink truncate leading-tight">
                {user?.name ?? "Employee"}
              </p>
              <p className="font-body text-xs text-ink-muted truncate">
                {user?.department_name ?? "General"}
              </p>
            </div>
          </div>

          <Link
            href="/employee/support"
            aria-current={pathname.startsWith("/employee/support") ? "page" : undefined}
            className={`flex items-center gap-3 px-4 min-h-[44px] rounded-control font-body text-sm transition-colors ${
              pathname.startsWith("/employee/support")
                ? "bg-accent-soft font-semibold text-accent-hover"
                : "font-medium text-ink hover:bg-surface-muted"
            }`}
          >
            <LifeBuoy
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                pathname.startsWith("/employee/support") ? "text-accent-hover" : "text-ink-muted"
              }`}
              strokeWidth={pathname.startsWith("/employee/support") ? 2.25 : 1.75}
              aria-hidden="true"
            />
            Support
          </Link>

          <button
            id="sidenav-logout-btn"
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 min-h-[44px] rounded-control font-body text-sm font-medium text-ink hover:bg-danger-soft hover:text-danger group transition-colors"
          >
            <LogOut
              className="w-[18px] h-[18px] text-ink-muted group-hover:text-danger transition-colors"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
