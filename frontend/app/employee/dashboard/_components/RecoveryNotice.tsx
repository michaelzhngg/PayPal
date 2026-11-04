"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { disputeRecovery } from "@/lib/actions/recoveries";
import type { Recovery } from "@/lib/api/reclaim-pay-types";
import { AFTER_WINDOW_LINE, DISPUTED_LINE, deadlineLine, isDisputeOpen, noticeLine } from "../_lib/copy";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * An overpayment the employee is asked to return. Written to inform, not
 * accuse: the amount, the claim, what happened and the dispute deadline.
 * Opens the dispute form on its own when the URL has ?recovery={id}.
 */
/** True when a notification linked here with ?recovery={id} and the dispute is still possible. */
function linkedHere(rec: Recovery): boolean {
  if (typeof window === "undefined") return false;
  const wanted = new URLSearchParams(window.location.search).get("recovery");
  return wanted === rec.recovery_id && rec.status === "NOTICE_SENT" && isDisputeOpen(rec);
}

export default function RecoveryNotice({ recovery: initial }: { recovery: Recovery }) {
  const [recovery, setRecovery] = useState(initial);
  const [formOpen, setFormOpen] = useState(() => linkedHere(initial));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Checked again on submit, so a window that closes while the page is open shows as closed.
  const [now, setNow] = useState(() => new Date());

  const sectionRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disputeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const ids = useId();

  const disputed = recovery.status === "DISPUTED";
  const open = isDisputeOpen(recovery, now);

  useEffect(() => {
    if (linkedHere(initial)) sectionRef.current?.scrollIntoView({ block: "center" });
  }, [initial]);

  useEffect(() => {
    if (formOpen) {
      textareaRef.current?.focus();
    } else if (returnFocus.current) {
      // Back to the button that opened the form.
      returnFocus.current = false;
      disputeButtonRef.current?.focus();
    }
  }, [formOpen]);

  function closeForm() {
    returnFocus.current = true;
    setFormOpen(false);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = note.trim();
    if (!text) {
      setError("Add a short note so HR knows what to check.");
      textareaRef.current?.focus();
      return;
    }
    const current = new Date();
    setNow(current);
    if (!isDisputeOpen(recovery, current)) {
      setFormOpen(false);
      return;
    }
    setSending(true);
    setError(null);
    const res = await disputeRecovery(recovery.recovery_id, text);
    setSending(false);
    if (res.error || !res.recovery) {
      setError("We couldn't send your dispute. Please try again.");
      return;
    }
    setRecovery(res.recovery);
    setFormOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Escape" && !sending) closeForm();
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby={`${ids}-heading`}
      className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 md:p-5"
    >
      <h3 id={`${ids}-heading`} className="font-headline text-base font-bold text-on-surface">
        Overpayment notice
      </h3>
      <p className="mt-1.5 font-body text-sm leading-relaxed text-on-surface">{noticeLine(recovery)}</p>
      <p className="mt-1 font-body text-sm leading-relaxed text-on-surface-variant">{recovery.reason}</p>

      <div aria-live="polite">
        {disputed ? (
          <p className="mt-3 font-body text-sm font-semibold text-on-surface">{DISPUTED_LINE}</p>
        ) : open ? (
          <p className="mt-3 font-body text-sm font-semibold text-on-surface">{deadlineLine(recovery, now)}</p>
        ) : (
          <>
            <p className="mt-3 font-body text-sm font-semibold text-on-surface">{deadlineLine(recovery, now)}</p>
            <p className="mt-1 font-body text-sm leading-relaxed text-on-surface-variant">{AFTER_WINDOW_LINE}</p>
          </>
        )}
      </div>

      {!disputed && open && !formOpen && (
        <button
          ref={disputeButtonRef}
          type="button"
          onClick={() => setFormOpen(true)}
          className={`mt-3 inline-flex min-h-11 items-center rounded-xl border border-outline px-4 py-2 font-body text-sm font-semibold text-on-surface hover:bg-surface-container ${focusRing}`}
        >
          Dispute
        </button>
      )}

      {!disputed && open && formOpen && (
        <form onSubmit={submit} onKeyDown={onKeyDown} noValidate className="mt-3 flex flex-col gap-2">
          <label htmlFor={`${ids}-note`} className="font-body text-sm font-semibold text-on-surface">
            What should HR know?
          </label>
          <textarea
            ref={textareaRef}
            id={`${ids}-note`}
            value={note}
            onChange={e => {
              setNote(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
            maxLength={1000}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids}-error` : undefined}
            placeholder="For example: breakfast wasn't included in my room rate."
            className={`w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 font-body text-base md:text-sm text-on-surface placeholder:text-on-surface-variant ${focusRing}`}
          />
          {error && (
            <p id={`${ids}-error`} role="alert" className="font-body text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={sending}
              className={`inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 font-body text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60 ${focusRing}`}
            >
              {sending ? "Sending…" : "Send dispute"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={sending}
              className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 font-body text-sm font-semibold text-on-surface-variant hover:bg-surface-container ${focusRing}`}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
