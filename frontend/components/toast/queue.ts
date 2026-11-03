export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  tone: ToastTone;
}

export interface ToastItem extends ToastInput {
  id: number;
}

export const MAX_TOASTS = 3;
export const TOAST_DURATION_MS = 5000;

/** Adds a toast, dropping the oldest once more than `max` are showing. */
export function pushToast(queue: ToastItem[], item: ToastItem, max = MAX_TOASTS): ToastItem[] {
  return [...queue, item].slice(-max);
}

export function removeToast(queue: ToastItem[], id: number): ToastItem[] {
  return queue.filter((t) => t.id !== id);
}
