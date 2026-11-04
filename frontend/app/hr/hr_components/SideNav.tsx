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
  Users,
  Banknote,
  Gauge,
  type LucideIcon,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/hr/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hr/policy", label: "Policy Studio", icon: FileSliders },
  { href: "/hr/manage_employee", label: "Manage Employee", icon: Users },
  { href: "/hr/history", label: "History", icon: History },
  { href: "/hr/payouts", label: "Payouts", icon: Banknote },
  { href: "/hr/autonomy", label: "Autonomy", icon: Gauge },
  { href: "/hr/settings", label: "Settings", icon: Settings },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 min-h-[44px] px-3 rounded-control font-body text-sm transition-colors ${
        active ? "bg-surface-muted font-semibold text-ink" : "font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
      }`}
    >
      <Icon
        className={`w-[18px] h-[18px] shrink-0 ${active ? "text-ink" : "text-ink-muted"}`}
        strokeWidth={active ? 2.25 : 1.75}
        aria-hidden="true"
      />
      {label}
    </Link>
  );
}

export default function SideNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Desktop sidebar" className="hidden lg:flex flex-col w-64 shrink-0 h-screen bg-surface border-r border-line">
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center gap-2.5 px-3 py-4 mb-3">
          <Image src="/images/logo.svg" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
          <div className="leading-tight">
            <p className="font-display font-semibold text-lg text-ink">Reclaim Pay</p>
            <p className="font-body text-xs text-ink-muted">HR Portal</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} {...link} active={isActive(link.href)} />
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-line flex flex-col gap-0.5">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="w-9 h-9 rounded-full bg-surface-muted shrink-0 flex items-center justify-center font-display font-semibold text-sm text-ink border border-line">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body font-semibold text-sm text-ink truncate leading-tight">{user?.name ?? "Employee"}</p>
              <p className="font-body text-xs text-ink-muted truncate">{user?.department_name ?? "General"}</p>
            </div>
          </div>

          <NavLink href="/hr/support" label="Support" icon={LifeBuoy} active={pathname.startsWith("/hr/support")} />

          <button
            id="sidenav-logout-btn"
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-control font-body text-sm font-medium text-ink-muted hover:bg-danger-soft hover:text-danger group transition-colors cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px] text-ink-muted group-hover:text-danger" strokeWidth={1.75} aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
