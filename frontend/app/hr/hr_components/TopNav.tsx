"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { getNotifications, markAllNotificationsRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/api/types";
import { Bell, HelpCircle, CheckCircle2, AlertCircle, Info } from "lucide-react";

let _notifCache: { data: Notification[]; ts: number } | null = null;
const NOTIF_TTL_MS = 15_000;

const NOTIF_ICON_MAP: Record<Notification["type"], { icon: typeof CheckCircle2; bg: string; text: string }> = {
  success: { icon: CheckCircle2, bg: "bg-accent/10",       text: "text-accent" },
  warning: { icon: AlertCircle,  bg: "bg-accent/20",      text: "text-accent" },
  error:   { icon: AlertCircle,  bg: "bg-danger/10",         text: "text-danger" },
  info:    { icon: Info,         bg: "bg-line",  text: "text-ink-muted" },
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
      className="sticky top-0 z-50 bg-paper border-b border-line/10 pt-safe-top"
    >
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 w-full max-w-screen-2xl mx-auto gap-3">

        {/* ── Left: Brand (mobile) ─────────────────── */}
        <div className="lg:hidden flex items-center gap-2">
          <Image src="/images/logo.svg" alt="Reclaim Logo" width={24} height={24} className="w-6 h-6 object-contain" />
          <span className="text-xl font-bold bg-linear-to-r from-accent to-accent bg-clip-text text-transparent font-display">
            Reclaim Pay
          </span>
        </div>

        {/* ── Center: Spacer (md+) ──────────────── */}
        <div className="flex-1 hidden md:block"></div>

        {/* ── Right: Actions + Avatar ───────────────── */}
        <div className="flex items-center gap-1 md:gap-2">

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              id="topnav-notification-btn"
              aria-label="Notifications"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer ${
                showNotifications ? "bg-line text-accent" : "text-ink hover:bg-surface-muted"
              }`}
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger border-2 border-paper pointer-events-none" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-paper border border-line/20 rounded-2xl shadow-overlay overflow-hidden animate-in fade-in slide-in-from-top-2 z-70">
                <div className="flex items-center justify-between p-4 border-b border-line/10 bg-surface">
                  <h3 className="font-display font-bold text-sm text-ink">Notifications</h3>
                  <button
                    className="text-[10px] font-bold text-accent hover:underline uppercase tracking-wider"
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
                          className={`w-full text-left flex gap-3 p-4 border-b border-line/5 ${
                            !notif.isRead ? "bg-accent/5" : ""
                          }`}
                        >
                          <div className="relative">
                            <div className={`p-2 h-fit ${iconConfig.bg} ${iconConfig.text} rounded-full shrink-0`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            {!notif.isRead && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-paper" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink">{notif.title}</p>
                            <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{notif.message}</p>
                            <span className="text-[10px] font-bold text-ink-muted/50 mt-1 block">{notif.timestamp}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-t border-line/10 text-center bg-surface">
                  <button
                    className="text-xs font-bold text-ink-muted hover:text-ink transition-colors"
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
            aria-label="Help"
            className="hidden sm:flex p-2.5 rounded-xl text-ink hover:bg-surface-muted active:scale-95 transition-all cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
          </button>

          {/* Avatar: opens mobile drawer on <lg */}
          <button
            id="topnav-profile-btn"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                window.dispatchEvent(new CustomEvent("open-mobile-nav-drawer"));
              }
            }}
            aria-label="Open settings menu"
            className="ml-1 h-9 w-9 rounded-full bg-linear-to-br from-accent-soft to-accent-soft shrink-0 flex items-center justify-center font-display font-bold text-sm text-accent-hover border-2 border-surface cursor-pointer hover:scale-105 transition-all"
          >
            {user?.name?.charAt(0).toUpperCase() ?? "U"}
          </button>

        </div>
      </div>
    </header>
  );
}
