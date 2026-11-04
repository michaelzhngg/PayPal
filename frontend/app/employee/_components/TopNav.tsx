"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { getNotifications, markAllNotificationsRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/api/types";
import { Upload, Bell, HelpCircle, CheckCircle2, AlertCircle, Info } from "lucide-react";

let _notifCache: { data: Notification[]; ts: number } | null = null;
const NOTIF_TTL_MS = 15_000;

/* ─── Icon map for notification types ────────────────── */
const NOTIF_ICON_MAP: Record<Notification["type"], { icon: typeof CheckCircle2; text: string }> = {
  success: { icon: CheckCircle2, text: "text-success" },
  warning: { icon: AlertCircle, text: "text-warning" },
  error:   { icon: AlertCircle, text: "text-danger" },
  info:    { icon: Info, text: "text-ink-muted" },
};

const iconBtn =
  "inline-flex items-center justify-center w-11 h-11 rounded-control text-ink hover:bg-surface-muted transition-colors cursor-pointer";

export default function TopNav() {
  const { user } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Click outside ref for notifications
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch notifications; skip if cache is still fresh
  useEffect(() => {
    const now = Date.now();
    if (_notifCache && now - _notifCache.ts < NOTIF_TTL_MS) {
      setNotifications(_notifCache.data);
      return;
    }
    getNotifications().then((data) => {
      _notifCache = { data, ts: Date.now() };
      setNotifications(data);
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, isRead: true }));
      _notifCache = { data: updated, ts: Date.now() };
      return updated;
    });
    setShowNotifications(false);
  }

  return (
    <header
      aria-label="Top navigation"
      className="sticky top-0 z-50 bg-paper border-b border-line pt-safe-top"
    >
      <div className="flex items-center justify-between px-4 md:px-6 py-2 md:py-3 w-full max-w-screen-2xl mx-auto gap-3">

        {/* ── Left: Brand (mobile) ─────────────────── */}
        <div className="lg:hidden flex items-center gap-2 min-w-0">
          <Image src="/images/logo.svg" alt="" width={24} height={24} className="w-6 h-6 object-contain" />
          <span className="font-display text-lg font-semibold text-ink truncate">
            Reclaim Pay
          </span>
        </div>

        {/* ── Center: Spacer ─────────────────── */}
        <div className="flex-1 hidden md:block"></div>

        {/* ── Right: Actions + Avatar ───────────────── */}
        <div className="flex items-center gap-1 md:gap-2">

          <Link
            id="topnav-upload-claim-btn"
            href="/employee/claims"
            className="hidden md:inline-flex items-center gap-2 min-h-[44px] px-4 rounded-control border border-line-strong bg-surface text-ink font-body font-semibold text-sm hover:bg-surface-muted transition-colors"
          >
            <Upload className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            Upload Claim
          </Link>

          {/* Notifications Dropdown Container */}
          <div className="relative" ref={notifRef}>
            <button
              id="topnav-notification-btn"
              type="button"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative ${iconBtn} ${showNotifications ? "bg-surface-muted" : ""}`}
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-danger ring-2 ring-paper pointer-events-none" />
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-line rounded-card shadow-overlay overflow-hidden z-70">
                <div className="flex items-center justify-between pl-4 pr-2 py-1 border-b border-line">
                  <h3 className="font-display font-semibold text-sm text-ink">Notifications</h3>
                  <button
                    type="button"
                    className="min-h-[44px] px-3 rounded-control text-xs font-semibold text-accent-hover hover:bg-surface-muted transition-colors"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="p-4 text-sm text-ink-muted">No notifications yet.</p>
                  )}
                  {notifications.map((notif) => {
                    const iconConfig = NOTIF_ICON_MAP[notif.type];
                    const IconComponent = iconConfig.icon;
                    return (
                      <button
                        key={notif.id}
                        type="button"
                        className={`w-full text-left flex gap-3 p-4 border-b border-line last:border-b-0 hover:bg-surface-muted transition-colors cursor-pointer ${
                          !notif.isRead ? "bg-surface-muted/60" : ""
                        }`}
                        onClick={() => setShowNotifications(false)}
                      >
                        <div className="relative shrink-0 pt-0.5">
                          <IconComponent className={`w-4 h-4 ${iconConfig.text}`} aria-hidden="true" />
                          {!notif.isRead && (
                            <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-danger rounded-full ring-2 ring-surface" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {!notif.isRead && <span className="sr-only">Unread: </span>}
                            {notif.title}
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{notif.message}</p>
                          <span className="text-xs text-ink-muted mt-1 block">{notif.timestamp}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-line">
                  <button
                    type="button"
                    className="w-full min-h-[44px] text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
                    onClick={() => setShowNotifications(false)}
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link
            id="topnav-help-btn"
            href="/employee/support"
            aria-label="Help"
            className={`hidden sm:inline-flex ${iconBtn}`}
          >
            <HelpCircle className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
          </Link>

          {/* Avatar: opens mobile drawer on <lg, links to settings on desktop */}
          <Link
            id="topnav-profile-btn"
            href="/employee/settings"
            onClick={(e) => {
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("open-mobile-nav-drawer"));
              }
            }}
            aria-label="Open settings menu"
            className="group ml-1 inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0 cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="h-9 w-9 rounded-full bg-surface-muted border border-line flex items-center justify-center font-body font-semibold text-sm text-ink group-hover:border-line-strong transition-colors"
            >
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </span>
          </Link>

        </div>

      </div>
    </header>
  );
}
