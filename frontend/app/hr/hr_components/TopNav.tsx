"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { getNotifications, markAllNotificationsRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/api/types";
import { Bell, HelpCircle, CheckCircle2, AlertCircle, Info } from "lucide-react";

let _notifCache: { data: Notification[]; ts: number } | null = null;
const NOTIF_TTL_MS = 15_000;

const NOTIF_ICON_MAP: Record<Notification["type"], { icon: typeof CheckCircle2; text: string }> = {
  success: { icon: CheckCircle2, text: "text-success" },
  warning: { icon: AlertCircle, text: "text-warning" },
  error: { icon: AlertCircle, text: "text-danger" },
  info: { icon: Info, text: "text-ink-muted" },
};

export default function TopNav() {
  const { user } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

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
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      <div className="flex items-center justify-between px-4 md:px-6 py-1.5 md:py-2 w-full max-w-screen-2xl mx-auto gap-3">

        {/* ── Left: Brand (mobile) ─────────────────── */}
        <div className="lg:hidden flex items-center gap-2">
          <Image src="/images/logo.svg" alt="" width={24} height={24} className="w-6 h-6 object-contain" />
          <span className="text-lg font-semibold text-ink font-display">Reclaim Pay</span>
        </div>

        {/* ── Center: Spacer (md+) ──────────────── */}
        <div className="flex-1 hidden md:block"></div>

        {/* ── Right: Actions + Avatar ───────────────── */}
        <div className="flex items-center gap-1 md:gap-2">

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              id="topnav-notification-btn"
              type="button"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative inline-flex items-center justify-center w-11 h-11 rounded-control transition-colors cursor-pointer ${
                showNotifications ? "bg-surface-muted text-ink" : "text-ink hover:bg-surface-muted"
              }`}
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger border-2 border-paper pointer-events-none" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-line rounded-card shadow-overlay overflow-hidden z-70">
                <div className="flex items-center justify-between pl-4 pr-2 py-1 border-b border-line">
                  <h3 className="font-display font-bold text-sm text-ink">Notifications</h3>
                  <button
                    type="button"
                    className="min-h-[44px] px-2 rounded-control text-xs font-semibold text-ink hover:underline cursor-pointer"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-ink-muted text-center py-8 px-4">
                      No notifications
                    </p>
                  ) : (
                    notifications.map((notif) => {
                      const iconConfig = NOTIF_ICON_MAP[notif.type];
                      const IconComponent = iconConfig.icon;
                      return (
                        <div
                          key={notif.id}
                          role="listitem"
                          className={`w-full text-left flex gap-3 p-4 border-b border-line ${
                            !notif.isRead ? "bg-surface-muted" : ""
                          }`}
                        >
                          <div className="relative shrink-0 pt-0.5">
                            <IconComponent className={`w-4 h-4 ${iconConfig.text}`} aria-hidden="true" />
                            {!notif.isRead && (
                              <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-danger rounded-full border border-surface">
                                <span className="sr-only">Unread</span>
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink">{notif.title}</p>
                            <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{notif.message}</p>
                            <span className="text-xs text-ink-muted mt-1 block">{notif.timestamp}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-1 border-t border-line text-center">
                  <button
                    type="button"
                    className="w-full min-h-[44px] rounded-control text-sm font-semibold text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                    onClick={() => setShowNotifications(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            id="topnav-help-btn"
            type="button"
            aria-label="Help"
            className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-control text-ink hover:bg-surface-muted transition-colors cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
          </button>

          {/* Avatar: opens mobile drawer on <lg */}
          <button
            id="topnav-profile-btn"
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                window.dispatchEvent(new CustomEvent("open-mobile-nav-drawer"));
              }
            }}
            aria-label="Open settings menu"
            className="ml-1 h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-full cursor-pointer group"
          >
            <span className="h-9 w-9 rounded-full bg-surface-muted border border-line flex items-center justify-center font-display font-semibold text-sm text-ink group-hover:border-line-strong transition-colors">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </span>
          </button>

        </div>
      </div>
    </header>
  );
}
