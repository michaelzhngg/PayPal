"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Search,
  ClipboardList,
  AlertCircle,
  Trash2,
  ArrowRight,
  FileText,
  Loader2,
} from "lucide-react";
import { listDrafts, deleteDraft } from "@/lib/actions/claims";
import type { DraftSummary } from "@/lib/api/types";

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    listDrafts().then((d) => {
      setDrafts(d);
      setLoading(false);
    });
  }, []);

  const filteredDrafts = useMemo(() => {
    if (!searchQuery.trim()) return drafts;
    const q = searchQuery.toLowerCase();
    return drafts.filter(
      (d) =>
        d.title?.toLowerCase().includes(q) ||
        d.main_category?.toLowerCase().includes(q)
    );
  }, [drafts, searchQuery]);

  async function handleDelete(draftId: string) {
    setDeletingId(draftId);
    const result = await deleteDraft(draftId);
    if (!result.error) {
      setDrafts((prev) => prev.filter((d) => d.draft_id !== draftId));
    }
    setDeletingId(null);
  }

  function handleResume(draftId: string) {
    router.push(`/employee/claims?draft_id=${draftId}`);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-12 lg:px-12 lg:pt-10 lg:pb-10 max-w-screen-xl mx-auto w-full">
      {/* Ambient gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-24 -left-24 w-96 h-96 rounded-full bg-linear-to-br from-accent/15 to-accent/10 blur-3xl z-0"
      />

      <div className="relative z-10 flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2
            className="font-display font-bold text-3xl md:text-4xl text-ink"
            style={{ letterSpacing: "-0.02em" }}
          >
            Saved Drafts
          </h2>
          <p className="text-base text-ink-muted font-body leading-relaxed">
            Resume incomplete claim submissions.
          </p>
        </div>

        {/* ── Localized Search Bar ── */}
        <div className="relative max-w-md w-full">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted/50"
            strokeWidth={2}
          />
          <input
            type="search"
            placeholder="Search drafts by title or policy…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-line/30 text-ink text-sm rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all placeholder:text-ink-muted/40"
          />
        </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent animate-spin" strokeWidth={2} />
        </div>
      )}

      {/* Empty state */}
      {!loading && drafts.length === 0 && (
        <div className="bg-surface rounded-2xl border border-line/15 flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-muted flex items-center justify-center mb-5">
            <Inbox className="w-7 h-7 text-line" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-semibold text-ink font-display mb-1.5">
            No drafts yet
          </h3>
          <p className="text-sm text-ink-muted font-body max-w-xs leading-relaxed mb-5">
            When you save an incomplete claim, it will appear here so you can
            resume it later.
          </p>
          <button
            onClick={() => router.push("/employee/claims")}
            className="px-5 py-2.5 rounded-xl bg-accent text-on-accent text-sm font-semibold font-body hover:scale-[1.02] active:scale-[0.97] transition-all"
          >
            Upload New Claim
          </button>
        </div>
      )}

      {/* Draft list */}
      {!loading && drafts.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredDrafts.map((draft) => {
            const isDeleting = deletingId === draft.draft_id;
            const hasFailed = draft.failed_receipt_count > 0;

            return (
              <div
                key={draft.draft_id}
                className={`bg-surface rounded-2xl border overflow-hidden transition-all duration-200 ${
                  hasFailed
                    ? "border-warning/60"
                    : "border-line/15"
                }`}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      hasFailed
                        ? "bg-warning-soft/80 text-warning"
                        : "bg-accent/8 text-accent"
                    }`}
                  >
                    <FileText className="w-5 h-5" strokeWidth={1.75} />
                  </div>

                  {/* Left Content Container: Title & Policy */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-ink font-display truncate">
                        {draft.title || "Untitled Draft"}
                      </p>
                      {hasFailed && (
                        <span className="shrink-0 text-[10px] font-bold text-warning bg-warning-soft border border-warning/30 px-2 py-0.5 rounded-full font-body flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {draft.failed_receipt_count} failed
                        </span>
                      )}
                    </div>
                    {draft.main_category && (
                      <div className="flex">
                        <span className="bg-surface-muted px-2 py-0.5 rounded-md text-[11px] font-medium text-ink-muted truncate max-w-[360px]">
                          {draft.main_category}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Content: Metadata & Actions */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="hidden sm:flex items-center text-xs text-ink-muted font-body">
                      <span className="whitespace-nowrap">
                        {draft.receipt_count} receipt{draft.receipt_count !== 1 ? "s" : ""}
                      </span>
                      <span className="mx-2 opacity-30">&bull;</span>
                      <span className="whitespace-nowrap">{formatDate(draft.updated_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(draft.draft_id)}
                        disabled={isDeleting}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-muted hover:bg-danger/10 hover:text-danger active:scale-90 transition-all"
                        aria-label="Delete draft"
                      >
                        {isDeleting ? (
                          <Loader2
                            className="w-4 h-4 animate-spin"
                            strokeWidth={2}
                          />
                        ) : (
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        )}
                      </button>
                      <button
                        onClick={() => handleResume(draft.draft_id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-on-accent text-sm font-semibold font-body hover:scale-[1.02] active:scale-[0.97] transition-all"
                      >
                        Resume
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
