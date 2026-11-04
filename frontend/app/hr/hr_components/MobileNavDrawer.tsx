"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Users, Gauge, Settings, LifeBuoy, LogOut, X, type LucideIcon } from "lucide-react";

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

// Only the pages that are not in the bottom nav.
const DRAWER_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/hr/manage_employee", label: "Manage Employee", icon: Users },
  { href: "/hr/autonomy", label: "Autonomy", icon: Gauge },
  { href: "/hr/settings", label: "Settings", icon: Settings },
  { href: "/hr/support", label: "Support", icon: LifeBuoy },
];

export default function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);

  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-close on route change
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || !open) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;

    // Only handle horizontal swipes (moving right = closing from right-side panel)
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && dx > 0) {
      setTranslateX(dx);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || !open) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.time;
    const velocity = dx / (dt || 1);

    // Close if swiped right far enough or fast enough
    const threshold = 80;
    if ((Math.abs(dx) > Math.abs(dy) * 1.5 && dx > threshold) || velocity > 0.5) {
      onClose();
    }

    setTranslateX(0);
    touchStart.current = null;
    setIsDragging(false);
  };

  const panelStyle: React.CSSProperties = {
    transform: `translate3d(${open ? translateX : 100}%, 0, 0)`,
    transition: isDragging ? "none" : "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-200 ${open ? "pointer-events-auto" : "pointer-events-none opacity-0"}`}
      role="dialog"
      aria-modal="true"
      aria-label="HR navigation"
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <nav
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute top-0 right-0 bottom-0 w-full md:w-[280px] md:max-w-[80vw] bg-surface border-l border-line shadow-overlay flex flex-col h-full p-4 touch-pan-y"
        style={panelStyle}
      >
        <div className="flex items-center justify-between pl-3 py-2 mb-2">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.svg" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            <div className="leading-tight">
              <p className="font-display font-semibold text-lg text-ink">Reclaim Pay</p>
              <p className="font-body text-xs text-ink-muted">HR Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-11 h-11 rounded-control hover:bg-surface-muted transition-colors cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5 text-ink" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 py-3 mb-4 border-y border-line">
          <div className="w-10 h-10 rounded-full bg-surface-muted border border-line shrink-0 flex items-center justify-center font-display font-semibold text-base text-ink">
            {user?.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body font-semibold text-sm text-ink truncate leading-tight">{user?.name ?? "Employee"}</p>
            <p className="font-body text-xs text-ink-muted truncate">{user?.department_name ?? "General"}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {DRAWER_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 min-h-[48px] px-3 rounded-control font-body text-sm transition-colors ${
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
          })}
        </div>

        <div className="mt-auto pt-4 border-t border-line">
          <button
            id="drawer-logout-btn"
            type="button"
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center gap-3 min-h-[48px] px-3 rounded-control font-body text-sm font-medium text-ink-muted hover:bg-danger-soft hover:text-danger group transition-colors cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px] text-ink-muted group-hover:text-danger" strokeWidth={1.75} aria-hidden="true" />
            Logout
          </button>
        </div>
      </nav>
    </div>
  );
}
