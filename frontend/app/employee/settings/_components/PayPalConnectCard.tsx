"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, BadgeCheck, Clock, Loader2, Wallet } from "lucide-react";
import { getConnectUrl, getPayeeStatus, unlinkPayPal } from "@/lib/actions/paypal";
import type { PayeeStatus } from "@/lib/api/reclaim-pay-types";
import { useToast } from "@/components/toast/ToastProvider";
import { linkChangesPausedUntil, payeeCardState } from "./payeeCardState";
import { callbackToast, connectFailedToast, UNLINK_FAILED_TOAST, UNLINKED_TOAST } from "./paypalToasts";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PayPalConnectCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<PayeeStatus | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const handledOutcome = useRef<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchStatus = useCallback(() => {
    return getPayeeStatus().then((result) => {
      setStatus(result);
      setLoadState(result ? "ready" : "error");
    });
  }, []);

  const reload = useCallback(() => {
    setLoadState("loading");
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // The PayPal callback lands here with ?paypal=linked|error. Toast it once, then drop it from the URL.
  // The ref keeps React's dev double-run of effects from toasting twice.
  const outcome = searchParams.get("paypal");
  useEffect(() => {
    if (!outcome) {
      handledOutcome.current = null;
      return;
    }
    if (handledOutcome.current === outcome) return;
    handledOutcome.current = outcome;
    const feedback = callbackToast(outcome);
    if (feedback) toast(feedback);
    router.replace("/employee/settings", { scroll: false });
  }, [outcome, router, toast]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    const { url, error } = await getConnectUrl();
    if (!url) {
      setConnecting(false);
      toast(connectFailedToast(error));
      return;
    }
    window.location.assign(url);
  }, [toast]);

  const handleUnlink = useCallback(async () => {
    setUnlinking(true);
    const { error } = await unlinkPayPal();
    setUnlinking(false);
    setConfirmingUnlink(false);
    if (error) {
      toast(UNLINK_FAILED_TOAST);
      return;
    }
    toast(UNLINKED_TOAST);
    reload();
  }, [reload, toast]);

  const cardState = status ? payeeCardState(status, new Date()) : null;
  const pausedUntil = status ? linkChangesPausedUntil(status, new Date()) : null;

  return (
    <section
      aria-labelledby="paypal-heading"
      className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="p-6 border-b border-outline-variant/10">
        <h2 id="paypal-heading" className="font-headline font-bold text-lg text-on-surface mb-1">
          PayPal Payouts
        </h2>
        <p className="font-body text-sm text-on-surface-variant">
          Approved claims are paid straight to the PayPal account you link here.
        </p>
      </div>

      <div className="p-6 space-y-4" aria-live="polite">
        {loadState === "ready" && pausedUntil && (
          <p className="flex items-start gap-2 rounded-xl px-4 py-3 bg-amber-50 text-amber-800 text-sm font-body">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              You signed in with PayPal, so payout account changes are paused until {formatWhen(pausedUntil)}. Approved
              claims still pay to this account. To change it sooner, sign out and sign in with your password.
            </span>
          </p>
        )}

        {loadState === "loading" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-container-low text-sm text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking your PayPal account…
          </div>
        )}

        {loadState === "error" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-error/5 border border-error/10">
            <p className="flex items-center gap-2 text-sm text-error font-body">
              <AlertCircle className="w-4 h-4 shrink-0" />
              We couldn&apos;t load your PayPal account.
            </p>
            <button
              onClick={reload}
              className="min-h-11 px-4 rounded-xl text-sm font-semibold text-on-surface border border-outline-variant/30 hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              Try again
            </button>
          </div>
        )}

        {loadState === "ready" && status && cardState === "notLinked" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-outline-variant/20 bg-surface-container-low">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-container text-on-primary-container rounded-lg">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="font-headline font-bold text-sm text-on-surface">No PayPal account linked</p>
                <p className="font-body text-xs text-on-surface-variant">
                  Link one to get approved claims paid automatically.
                </p>
              </div>
            </div>
            {!pausedUntil && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="min-h-11 flex items-center justify-center gap-2 bg-primary text-on-primary px-5 rounded-xl font-bold text-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {connecting ? "Opening PayPal…" : "Connect PayPal"}
              </button>
            )}
          </div>
        )}

        {loadState === "ready" && status && cardState && cardState !== "notLinked" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-outline-variant/20 bg-surface-container-low">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 bg-primary-container text-on-primary-container rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-headline font-bold text-sm text-on-surface truncate">
                    {status.email_masked ?? "PayPal account"}
                  </p>
                  {status.linked_at && (
                    <p className="font-body text-xs text-on-surface-variant">Linked {formatWhen(status.linked_at)}</p>
                  )}
                </div>
              </div>
              {cardState === "verified" && (
                <span className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                  <BadgeCheck className="w-4 h-4" />
                  Instant payouts on
                </span>
              )}
            </div>

            {cardState === "coolDown" && status.cooldown_until && (
              <p className="flex items-start gap-2 rounded-xl px-4 py-3 bg-amber-50 text-amber-800 text-sm font-body">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                Payout account changed. Instant payouts resume {formatWhen(status.cooldown_until)}.
              </p>
            )}

            {cardState === "unverified" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-4 py-3 bg-amber-50 text-amber-800">
                <p className="flex items-start gap-2 text-sm font-body">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  Verify your PayPal account to get instant payouts. Once PayPal has verified it, reconnect here.
                </p>
                {!pausedUntil && (
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="min-h-11 px-4 rounded-xl text-sm font-semibold bg-amber-800 text-white hover:bg-amber-900 transition-colors disabled:opacity-60 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                  >
                    {connecting ? "Opening PayPal…" : "Reconnect PayPal"}
                  </button>
                )}
              </div>
            )}

            {pausedUntil ? null : !confirmingUnlink ? (
              <div className="flex justify-end">
                <button
                  onClick={() => setConfirmingUnlink(true)}
                  className="min-h-11 px-4 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Unlink PayPal
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-outline-variant/20 p-4 space-y-3">
                <p className="font-body text-sm text-on-surface">
                  Unlinking stops automatic payouts. If you link a PayPal account again, instant payouts pause for 72 hours.
                </p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={() => setConfirmingUnlink(false)}
                    disabled={unlinking}
                    className="min-h-11 px-4 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Keep it linked
                  </button>
                  <button
                    onClick={handleUnlink}
                    disabled={unlinking}
                    className="min-h-11 px-4 rounded-xl text-sm font-bold bg-error text-on-error hover:bg-error-dim transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                  >
                    {unlinking ? "Unlinking…" : "Unlink account"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
