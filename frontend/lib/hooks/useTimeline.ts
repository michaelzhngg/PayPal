"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { subscribeToProgress } from "@/lib/sse";
import type { AutonomyDecision, TimelineEvent, TimelineStepState } from "@/lib/api/reclaim-pay-types";

export type TimelineAudience = "employee" | "hr";

const SILENCE_MS = 20_000;
const POLL_MS = 3_000;
// Compliance runs several LLM calls; give a slow analysis room before telling the employee to check later.
const GIVE_UP_MS = 300_000;

/**
 * Folds one timeline event into the rendered steps. Rows keep the order they
 * were first seen and the latest status wins. For employees, a shield step that
 * flagged something (or failed to run) reads as done with no detail, and the
 * decision step drops its explanation: the employee only ever sees the
 * generic outcome copy, never which check fired.
 */
export function reduceTimeline(
  steps: TimelineStepState[],
  ev: TimelineEvent,
  audience: TimelineAudience,
): TimelineStepState[] {
  let { status, detail } = ev;
  if (audience === "employee") {
    if (ev.step.startsWith("shield.") && (status === "warn" || status === "fail")) {
      status = "done";
      detail = null;
    }
    if (ev.step === "autonomy.decide") detail = null;
  }
  const next: TimelineStepState = { step: ev.step, label: ev.label, status, detail };
  const i = steps.findIndex(s => s.step === ev.step);
  if (i === -1) return [...steps, next];
  const copy = steps.slice();
  copy[i] = next;
  return copy;
}

/** Pulls the autonomy decisions out of an analysis `complete` payload. */
export function decisionsFrom(result: Record<string, unknown>): AutonomyDecision[] {
  const rows = Array.isArray(result.reimbursements) ? (result.reimbursements as Record<string, unknown>[]) : [];
  return rows
    .map(r => r.autonomy as AutonomyDecision | null | undefined)
    .filter((d): d is AutonomyDecision => !!d && typeof d === "object" && "tier" in d);
}

interface TimelineData {
  steps: TimelineStepState[];
  decisions: AutonomyDecision[];
  done: boolean;
  error: string | null;
}

interface TimelineState extends TimelineData {
  source: object | null;
}

const EMPTY: TimelineData = { steps: [], decisions: [], done: false, error: null };

/** Applies a patch to the state of `source`, starting fresh if the state belongs to an older source. */
function updater(setState: Dispatch<SetStateAction<TimelineState>>, source: object) {
  return (patch: (s: TimelineData) => Partial<TimelineData>) =>
    setState(prev => {
      const base = prev.source === source ? prev : { source, ...EMPTY };
      return { ...base, ...patch(base) };
    });
}

interface UseTimelineOptions {
  /** Feed these events on a timer instead of listening to the stream. */
  replay?: TimelineEvent[];
  /** Decisions to reveal once a replay finishes. */
  replayDecisions?: AutonomyDecision[];
  speedMs?: number;
  audience?: TimelineAudience;
  /**
   * Fallback when the stream errors or goes quiet for 20 s: returns the
   * `complete` payload once the claim is saved, or null while it isn't.
   */
  poll?: () => Promise<Record<string, unknown> | null>;
  onComplete?: (result: Record<string, unknown>) => void;
  onError?: (message: string) => void;
}

/**
 * Live agent timeline for one analysis task. It owns the task's SSE
 * subscription, since the backend queue serves only one listener per task.
 */
export function useTimeline(
  taskId: string | null,
  opts: UseTimelineOptions = {},
): { steps: TimelineStepState[]; decisions: AutonomyDecision[]; done: boolean; error: string | null } {
  const { replay, replayDecisions, speedMs = 450, audience = "employee" } = opts;

  // State belongs to one source (a task, or a replay, for one audience). A new
  // source starts from empty without resetting state inside the effects.
  const source = useMemo(() => ({ replay, taskId, audience }), [replay, taskId, audience]);
  const [state, setState] = useState<TimelineState>({ source: null, ...EMPTY });
  const current = state.source === source ? state : { source, ...EMPTY };

  // Callbacks change every render; keep the latest without restarting the stream.
  const callbacks = useRef(opts);
  useEffect(() => {
    callbacks.current = opts;
  });

  useEffect(() => {
    if (!replay) return;
    const update = updater(setState, source);
    let i = 0;
    const timer = setInterval(() => {
      if (i >= replay.length) {
        clearInterval(timer);
        update(() => ({ decisions: replayDecisions ?? [], done: true }));
        return;
      }
      const ev = replay[i++];
      update(s => ({ steps: reduceTimeline(s.steps, ev, audience) }));
    }, speedMs);
    return () => clearInterval(timer);
  }, [source, replay, replayDecisions, speedMs, audience]);

  useEffect(() => {
    if (replay || !taskId) return;
    const update = updater(setState, source);

    let settled = false;
    let polling = false;
    let silence: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let stream: { close: () => void } | null = null;

    const finish = (result: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(silence);
      clearTimeout(pollTimer);
      stream?.close();
      update(() => ({ decisions: decisionsFrom(result), done: true }));
      callbacks.current.onComplete?.(result);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(silence);
      clearTimeout(pollTimer);
      stream?.close();
      update(() => ({ error: message }));
      callbacks.current.onError?.(message);
    };

    const startPolling = (reason: string) => {
      const poll = callbacks.current.poll;
      if (!poll) {
        fail(reason);
        return;
      }
      if (polling) return;
      polling = true;
      const tick = async () => {
        if (settled) return;
        const result = await poll().catch(() => null);
        if (settled) return;
        if (result) {
          finish(result);
          return;
        }
        if (Date.now() - startedAt >= GIVE_UP_MS) {
          fail("We couldn't confirm your claim's status. Check your claim history in a minute.");
          return;
        }
        pollTimer = setTimeout(tick, POLL_MS);
      };
      tick();
    };

    const armSilence = () => {
      clearTimeout(silence);
      silence = setTimeout(() => startPolling("The connection went quiet."), SILENCE_MS);
    };

    stream = subscribeToProgress(taskId, "reimbursements", {
      onProgress: (stage, data) => {
        armSilence();
        if (stage === "timeline") {
          const ev = data as unknown as TimelineEvent;
          update(s => ({ steps: reduceTimeline(s.steps, ev, audience) }));
        }
      },
      onComplete: finish,
      onError: message => startPolling(message),
    });
    armSilence();

    return () => {
      settled = true;
      clearTimeout(silence);
      clearTimeout(pollTimer);
      stream?.close();
    };
  }, [source, taskId, replay, audience]);

  const { steps, decisions, done, error } = current;
  return { steps, decisions, done, error };
}
