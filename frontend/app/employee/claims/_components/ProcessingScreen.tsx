"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ScanLine, FileSearch, DatabaseZap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessingScreenProps {
  /** Total number of uploaded receipts being processed. */
  totalFiles:   number;
  /** Index of the receipt currently being processed (0-based). */
  currentIndex: number;
  /**
   * Trail log step within the current receipt:
   *   0 = Scanning document
   *   1 = Reading content
   *   2 = Extracting data
   */
  currentStep:  number;
  /** Names of fully-completed receipts (for the log list below the stepper). */
  completedFileNames: string[];
  /** Current SSE progress stage name. */
  currentStage?: string;
  /** Live data payload from the current SSE progress stage. */
  stageData?: Record<string, unknown>;
}

// ─── Trail log steps ──────────────────────────────────────────────────────────

const TRAIL_STEPS = [
  {
    id:       "scan",
    icon:     ScanLine,
    label:    "Scanning document",
    subtitle: "Document image captured.",
  },
  {
    id:       "read",
    icon:     FileSearch,
    label:    "Reading content",
    subtitle: "Text layer extracted.",
  },
  {
    id:       "extract",
    icon:     DatabaseZap,
    label:    "Extracting data",
    subtitle: "Fields identified and mapped.",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function ProcessingScreen({
  totalFiles,
  currentIndex,
  currentStep,
  completedFileNames,
  currentStage,
  stageData,
}: ProcessingScreenProps) {
  const [animPct, setAnimPct] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    animRef.current = setInterval(() => {
      setAnimPct(prev => {
        if (prev >= 93) return prev;
        const bump = 0.3 + Math.random() * 0.8;
        return Math.min(Math.round(prev + bump), 93);
      });
    }, 180);

    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, []);

  const realPct = stageData?.current != null && stageData?.total != null
    ? Math.round(((stageData.current as number) / (stageData.total as number)) * 100)
    : totalFiles > 0
      ? Math.round((currentIndex / totalFiles) * 100)
      : 0;

  const overallPct = currentStage === "complete" ? 100 : Math.max(animPct, realPct);

  const stageLabel = currentStage === "saving"
    ? "Saving to database..."
    : null;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col justify-center mt-6 md:mt-12">
      <div className="relative rounded-3xl overflow-hidden flex flex-col sm:flex-row min-h-[480px] w-full">

        {/* ── Left: Gradient anchor ──────────────────────────────────────────── */}
        <div
          className="sm:w-[42%] p-8 flex flex-col justify-between relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #4647d3 0%, #9396ff 50%, #9e00b4 100%)" }}
        >
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/20 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4 pointer-events-none" />

          {/* Icon + Title */}
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
              <ScanLine className="w-6 h-6 text-white" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-2xl font-bold text-white leading-snug">
              Processing<br />Receipts
            </h2>
            <p className="text-white/70 text-sm font-body mt-2 leading-relaxed">
              Reclaim AI is reading your documents. Please keep this window open.
            </p>
          </div>

          {/* Overall progress */}
          <div className="relative z-10 mt-6">
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-white/70 font-body font-semibold uppercase tracking-widest">
                  Overall Progress
                </p>
                <span className="text-white text-xs font-bold font-body">
                  {overallPct}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700 ease-in-out"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <p className="text-white/80 text-xs font-body mt-2">
                {stageData?.filename
                  ? String(stageData.filename)
                  : `Receipt ${Math.min(currentIndex + 1, totalFiles)} of ${totalFiles}`}
              </p>
              {stageLabel && (
                <p className="text-white/70 text-xs font-body mt-1">
                  {stageLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Trail log stepper ───────────────────────────────────────── */}
        <div className="flex-1 bg-surface p-8 sm:p-10 flex flex-col">

          {/* Active receipt label */}
          <div className="mb-8">
            <p className="text-[11px] text-accent/80 font-body font-bold uppercase tracking-widest mb-1">
              Currently Processing
            </p>
            <h3 className="font-display text-lg font-semibold text-ink leading-tight">
              {(stageData?.filename ? String(stageData.filename) : null) || `Receipt ${currentIndex + 1} of ${totalFiles}`}
            </h3>
            <p className="text-ink-muted text-sm font-body mt-0.5">
              {stageLabel || "Running AI vision extraction…"}
            </p>
          </div>

          {/* Trail log stepper */}
          <div className="relative ml-3 mb-8">
            {/* Background track */}
            <div className="absolute top-3 bottom-3 left-[11px] w-0.5 bg-line rounded-full" />
            {/* Progress fill */}
            <div
              className="absolute top-3 left-[11px] w-0.5 bg-accent rounded-full transition-all duration-700 ease-in-out"
              style={{
                height:
                  currentStep === 0 ? "0%" :
                  currentStep === 1 ? "40%" :
                  "80%",
              }}
            />

            <div className="flex flex-col gap-7">
              {TRAIL_STEPS.map((step, idx) => {
                const StepIcon   = step.icon;
                const isCompleted = idx < currentStep;
                const isActive    = idx === currentStep;
                const isPending   = idx > currentStep;

                return (
                  <div key={step.id} className="flex items-start gap-5 relative">
                    {/* Dot indicator */}
                    {isCompleted && (
                      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <CheckCircle2 className="w-3.5 h-3.5 text-on-accent" strokeWidth={2.5} />
                      </div>
                    )}
                    {isActive && (
                      <div className="w-6 h-6 rounded-full bg-accent border-[3px] border-surface flex items-center justify-center shrink-0 mt-0.5 relative z-10">
                        <div className="absolute inset-[-4px] rounded-full border-2 border-accent/50 animate-ping" />
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                    {isPending && (
                      <div className="w-6 h-6 rounded-full bg-surface-muted border border-line/30 shrink-0 mt-0.5 z-10" />
                    )}

                    {/* Step text */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isActive    ? "bg-accent/15" :
                        isCompleted ? "bg-accent/10" :
                                      "bg-surface-muted"
                      }`}>
                        <StepIcon
                          className={`w-4 h-4 transition-colors ${
                            isActive    ? "text-accent" :
                            isCompleted ? "text-accent/70" :
                                          "text-line/40"
                          }`}
                          strokeWidth={1.75}
                        />
                      </div>
                      <div>
                        <p className={`font-semibold text-sm leading-tight font-display ${
                          isActive    ? "text-accent" :
                          isCompleted ? "text-ink" :
                                        "text-ink-muted/40"
                        }`}>
                          {step.label}
                        </p>
                        {(isCompleted || isActive) && (
                          <p className="text-ink-muted text-xs mt-0.5 font-body leading-relaxed">
                            {step.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completed receipts log */}
          {completedFileNames.length > 0 && (
            <div className="mt-auto pt-4 border-t border-line/10">
              <p className="text-[10px] text-ink-muted/60 font-body font-semibold uppercase tracking-widest mb-2">
                Completed
              </p>
              <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1
                [&::-webkit-scrollbar]:w-1
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-line/20
                [&::-webkit-scrollbar-thumb]:rounded-full">
                {completedFileNames.map((name, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs font-body text-ink-muted animate-in fade-in slide-in-from-bottom-1 duration-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" strokeWidth={2} />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
