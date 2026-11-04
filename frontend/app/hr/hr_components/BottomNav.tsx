"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileSliders, History, Banknote, Settings } from "lucide-react";
import MobileNavDrawer from "./MobileNavDrawer";

const NAV_ITEMS = [
  { href: "/hr/dashboard", label: "Home",    icon: Home         },
  { href: "/hr/policy",    label: "Policy",  icon: FileSliders  },
  { href: "/hr/history",   label: "History", icon: History      },
  { href: "/hr/payouts",   label: "Payouts", icon: Banknote     },
  { href: "/hr/settings",  label: "Settings", icon: Settings    },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Listen for TopNav avatar click (mobile only)
  useEffect(() => {
    const handler = () => {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setDrawerOpen(true);
      }
    };
    window.addEventListener("open-mobile-nav-drawer", handler);
    return () => window.removeEventListener("open-mobile-nav-drawer", handler);
  }, []);

  return (
    <>
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* FAB exception: `fixed` is allowed here per layout constraints */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-line pb-safe"
      >
        <div className="flex justify-between items-center px-2 h-16 max-w-lg mx-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            const content = (
              <>
                <Icon
                  className="w-[22px] h-[22px]"
                  strokeWidth={isActive ? 2.25 : 1.5}
                  aria-hidden="true"
                />
                <span className="text-xs font-body font-medium whitespace-nowrap max-w-[72px] overflow-hidden text-ellipsis">
                  {label}
                </span>
              </>
            );

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] px-1 py-1.5 rounded-control transition-colors ${
                  isActive
                    ? "text-ink font-semibold bg-surface-muted"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
