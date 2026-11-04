"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
  CalendarDays,
  Settings,
  LifeBuoy,
  LogOut,
  X,
} from "lucide-react";

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

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

  // Auto-close on route change
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isCalendarActive = pathname === "/employee/calendar" || pathname.startsWith("/employee/calendar/");
  const isSettingsActive = pathname === "/employee/settings" || pathname.startsWith("/employee/settings/");
  const isSupportActive = pathname === "/employee/support" || pathname.startsWith("/employee/support/");

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
    transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return (
    <div
      className={`fixed inset-0 z-[60] transition-all duration-300 ${open ? "pointer-events-auto" : "pointer-events-none opacity-0"}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Panel: slides from right */}
      <nav
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute top-0 right-0 bottom-0 w-full md:w-[280px] md:max-w-[80vw] bg-surface border-l border-line shadow-overlay flex flex-col h-full p-4 touch-pan-y motion-reduce:transition-none"
        style={panelStyle}
      >
        {/* Close + Brand */}
        <div className="flex items-center justify-between px-4 py-3 mb-2">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.svg" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            <span className="font-display font-semibold text-xl text-ink">
              Reclaim Pay
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-control hover:bg-surface-muted transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5 text-ink" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <p
          className="font-body text-xs font-medium text-ink-muted px-4 mb-6 leading-tight transition-all duration-300"
          style={{ transitionDelay: open ? "40ms" : "0ms", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)" }}
        >
          Employee Portal
        </p>

        {/* User identity chip */}
        <div
          className="flex items-center gap-3 px-4 py-3 mb-4 rounded-card bg-surface-muted transition-all duration-300"
          style={{ transitionDelay: open ? "80ms" : "0ms", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)" }}
        >
          <div aria-hidden="true" className="w-10 h-10 rounded-full bg-surface border border-line shrink-0 flex items-center justify-center font-body font-semibold text-base text-ink">
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

        {/* Links: only items NOT in the bottom nav */}
        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          <Link
            href="/employee/calendar"
            onClick={onClose}
            aria-current={isCalendarActive ? "page" : undefined}
            className={`flex items-center gap-3 px-4 min-h-[44px] rounded-control font-body text-sm transition-all duration-200 ${
              isCalendarActive
                ? "bg-accent-soft font-semibold text-accent-hover"
                : "font-medium text-ink hover:bg-surface-muted"
            }`}
            style={{ transitionDelay: open ? "100ms" : "0ms", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)" }}
          >
            <CalendarDays
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                isCalendarActive ? "text-accent-hover" : "text-ink-muted"
              }`}
              strokeWidth={isCalendarActive ? 2.25 : 1.75}
              aria-hidden="true"
            />
            Calendar
          </Link>

          <Link
            href="/employee/settings"
            onClick={onClose}
            aria-current={isSettingsActive ? "page" : undefined}
            className={`flex items-center gap-3 px-4 min-h-[44px] rounded-control font-body text-sm transition-all duration-200 ${
              isSettingsActive
                ? "bg-accent-soft font-semibold text-accent-hover"
                : "font-medium text-ink hover:bg-surface-muted"
            }`}
            style={{ transitionDelay: open ? "120ms" : "0ms", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)" }}
          >
            <Settings
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                isSettingsActive ? "text-accent-hover" : "text-ink-muted"
              }`}
              strokeWidth={isSettingsActive ? 2.25 : 1.75}
              aria-hidden="true"
            />
            Settings
          </Link>

          <Link
            href="/employee/support"
            onClick={onClose}
            aria-current={isSupportActive ? "page" : undefined}
            className={`flex items-center gap-3 px-4 min-h-[44px] rounded-control font-body text-sm transition-all duration-200 ${
              isSupportActive
                ? "bg-accent-soft font-semibold text-accent-hover"
                : "font-medium text-ink hover:bg-surface-muted"
            }`}
            style={{ transitionDelay: open ? "160ms" : "0ms", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)" }}
          >
            <LifeBuoy
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                isSupportActive ? "text-accent-hover" : "text-ink-muted"
              }`}
              strokeWidth={isSupportActive ? 2.25 : 1.75}
              aria-hidden="true"
            />
            Support
          </Link>
        </div>

        {/* Bottom: Logout */}
        <div
          className="mt-auto pt-4 border-t border-line transition-all duration-300"
          style={{ transitionDelay: open ? "200ms" : "0ms", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)" }}
        >
          <button
            id="drawer-logout-btn"
            type="button"
            onClick={() => { logout(); onClose(); }}
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
      </nav>
    </div>
  );
}
