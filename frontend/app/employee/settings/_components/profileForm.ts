import type { ToastInput } from "@/components/toast/queue";

export interface ProfileDraft {
  name: string;
  email: string;
}

/** What PUT /auth/me receives: trimmed values. Email case is kept, since login matches it exactly. */
export function normalizeProfile(d: ProfileDraft): ProfileDraft {
  return { name: d.name.trim().replace(/\s+/g, " "), email: d.email.trim() };
}

/** The first problem with the draft, or null when it can be saved. */
export function profileError(d: ProfileDraft): string | null {
  const p = normalizeProfile(d);
  if (!p.name) return "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return "Enter an email address like name@company.com.";
  return null;
}

export function isProfileChanged(draft: ProfileDraft, saved: ProfileDraft): boolean {
  const a = normalizeProfile(draft);
  const b = normalizeProfile(saved);
  return a.name !== b.name || a.email !== b.email;
}

export const PROFILE_SAVED_TOAST: ToastInput = { tone: "success", title: "Profile saved" };

export function profileFailedToast(error: string | null): ToastInput {
  return {
    tone: "error",
    title: "Couldn't save your profile",
    description: error ? `${error.replace(/\.$/, "")}. Nothing was changed.` : "Nothing was changed. Try again in a moment.",
  };
}
