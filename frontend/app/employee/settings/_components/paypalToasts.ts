import type { ToastInput } from "@/components/toast/queue";

/** Feedback for the `?paypal=` outcome the PayPal callback redirects back with. */
export function callbackToast(outcome: string | null): ToastInput | null {
  if (outcome === "linked") {
    return { tone: "success", title: "PayPal account linked", description: "Instant payouts are on." };
  }
  if (outcome === "error") {
    return {
      tone: "error",
      title: "PayPal didn't link your account",
      description: "Nothing was changed. Try connecting again.",
    };
  }
  return null;
}

export function connectFailedToast(error: string | null): ToastInput {
  return {
    tone: "error",
    title: "Couldn't open PayPal",
    description: error ? `${error}. Try again in a moment.` : "Try again in a moment.",
  };
}

export const UNLINKED_TOAST: ToastInput = {
  tone: "info",
  title: "PayPal account unlinked",
  description: "Automatic payouts are off until you link an account again.",
};

export const UNLINK_FAILED_TOAST: ToastInput = {
  tone: "error",
  title: "Couldn't unlink your PayPal account",
  description: "It's still linked. Try again.",
};
