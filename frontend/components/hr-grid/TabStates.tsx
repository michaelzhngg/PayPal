"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

export function TabLoading({ label }: { label: string }) {
  return (
    <div role="status">
      <p className="sr-only">{label}</p>
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-[52px] rounded-lg bg-surface-container-low animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
    >
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-lg bg-surface-container-lowest border border-red-200 font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-700 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

export function TabEmpty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-14 text-center">
      <Inbox className="w-8 h-8 mx-auto text-on-surface-variant" aria-hidden="true" />
      <p className="font-headline font-bold text-lg text-on-surface mt-3">{title}</p>
      <p className="text-sm text-on-surface-variant mt-1">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
