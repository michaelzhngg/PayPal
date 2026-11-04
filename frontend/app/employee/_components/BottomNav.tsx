"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, History, ClipboardList, Settings } from "lucide-react";
import { getDraftCount } from "@/lib/actions/claims";
import MobileNavDrawer from "./MobileNavDrawer";

const NAV_ITEMS = [
  { href: "/employee/dashboard", label: "Home",    icon: Home         },
  { href: "/employee/drafts",    label: "Drafts",  icon: ClipboardList },
  { href: "/employee/claims",    label: "Upload",  icon: Upload       },
  { href: "/employee/history",   label: "History", icon: History      },
  { href: "/employee/settings",  label: "Settings", icon: Settings    },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [draftCount, setDraftCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hide while the camera modal is open (CameraModal adds/removes this class)
  const [cameraOpen, setCameraOpen] = useState(false);
  useEffect(() => {
    const check = () => setCameraOpen(document.body.classList.contains("camera-open"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Fetch draft count
  useEffect(() => {
    getDraftCount().then(count => setDraftCount(count));
  }, [pathname]);

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

  if (cameraOpen) return null;

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
            const isDrafts = label === "Drafts";
            const isUpload = label === "Upload";

            const content = (
              <>
                <Icon
                  className={`w-[22px] h-[22px] ${isUpload && !isActive ? "text-accent" : ""}`}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                <span className={`text-[11px] font-body font-medium whitespace-nowrap max-w-[64px] overflow-hidden text-ellipsis ${isUpload && !isActive ? "text-accent-hover" : ""}`}>
                  {label}
                </span>
                {isDrafts && draftCount > 0 && (
                  <span className="absolute top-1 right-[calc(50%-22px)] bg-ink text-on-accent font-mono text-[10px] font-medium min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center">
                    <span className="sr-only">, </span>
                    {draftCount > 9 ? "9+" : draftCount}
                    <span className="sr-only"> drafts</span>
                  </span>
                )}
              </>
            );

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 px-1 min-h-[52px] rounded-control transition-colors ${
                  isActive
                    ? "text-accent-hover bg-accent-soft"
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
