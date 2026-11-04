"use client";

import PayPalMark from "@/components/ui/PayPalMark";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, ArrowRight, Users } from "lucide-react";
import Image from "next/image";
import LoadingOverlay from "@/components/LoadingOverlay";

const formSchema = z.object({
  email: z.string().email({ message: "Enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

// ─── Main Component ──────────────────────────────────────────────────────────

const DEMO_CREDENTIALS: Record<"hr" | "employee", { email: string; password: string }> = {
  hr: { email: "hr@example.com", password: "password" },
  employee: { email: "employee@example.com", password: "password" },
};

const PAYPAL_FAILED_MESSAGE =
  "We couldn't sign you in with PayPal. Use your email and password, or ask HR to check your PayPal link.";

const FORGOT_PASSWORD_MESSAGE =
  "Password reset is not available in this demo. Use a demo account above, or ask HR to reset your password.";

const inputClass =
  "w-full min-h-11 rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink-muted transition-colors hover:border-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent";

const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted disabled:opacity-50";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restrictionToast, setRestrictionToast] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [demoBanner, setDemoBanner] = useState<"hr" | "employee" | null>(null);
  const [openingPayPal, setOpeningPayPal] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleDemoLogin(role: "hr" | "employee") {
    setError(null);
    setDemoBanner(role);
    setIsValidating(true);
    const creds = DEMO_CREDENTIALS[role];
    form.setValue("email", creds.email);
    form.setValue("password", creds.password);
    try {
      await login(creds.email, creds.password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Demo sign-in failed. Try again.";
      setError(message);
      setDemoBanner(null);
    } finally {
      setIsValidating(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null);
    setIsValidating(true);
    try {
      await login(values.email, values.password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed. Please check your credentials.";
      setError(message);
    } finally {
      setIsValidating(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demo = params.get("demo");

    if (params.get("paypal") === "failed") {
      setError(PAYPAL_FAILED_MESSAGE);
      window.history.replaceState(null, "", "/login");
    }

    if (demo === "hr" || demo === "employee") {
      const creds = DEMO_CREDENTIALS[demo];
      form.setValue("email", creds.email);
      form.setValue("password", creds.password);
      setDemoBanner(demo);
      setIsValidating(true);
      login(creds.email, creds.password).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Demo sign-in failed. Try again.";
        setError(message);
        setDemoBanner(null);
      }).finally(() => setIsValidating(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back from PayPal with the browser's Back button restores this page from memory, mid-"Opening".
  useEffect(() => {
    const reset = () => setOpeningPayPal(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  useEffect(() => {
    if (!restrictionToast) return;
    const timer = window.setTimeout(() => setRestrictionToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [restrictionToast]);

  const handleForgotPassword = () => {
    setRestrictionToast(FORGOT_PASSWORD_MESSAGE);
  };

  const busy = isLoading || isValidating;

  return (
    <>
      <LoadingOverlay show={isLoading} />
      <main className="flex w-full min-h-dvh">
        {/* Left side, desktop only: what the product does, in plain words. */}
        <section
          aria-labelledby="login-intro"
          className="hidden lg:flex w-1/2 flex-col justify-between gap-12 border-r border-line bg-surface p-12 xl:p-16"
        >
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.svg" alt="" width={32} height={32} className="w-8 h-8 object-contain" priority />
            <span className="font-display text-xl font-semibold text-ink">Reclaim Pay</span>
          </div>

          <div className="max-w-md">
            <h1 id="login-intro" className="font-display text-4xl xl:text-5xl font-semibold leading-tight text-ink">
              Expense claims paid to your PayPal
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              Upload a receipt and it is checked against your company&apos;s policy. Claims that pass every check
              are paid to your PayPal in under a minute. Anything unusual goes to HR, and a person decides.
            </p>

            <hr className="perforated my-8" />

            <ol className="space-y-4 text-sm text-ink">
              <li className="flex gap-3">
                <span className="font-mono text-ink-muted">01</span>
                <span>Upload a photo or PDF of the receipt.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ink-muted">02</span>
                <span>The merchant, date and amount are read and checked against policy.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-ink-muted">03</span>
                <span>Clean claims are paid out. HR reviews the rest, with the evidence.</span>
              </li>
            </ol>
          </div>

          <p className="text-sm text-ink-muted">Demo build. Every payment uses the PayPal sandbox.</p>
        </section>

        {/* Right side: sign in. */}
        <div className="w-full lg:w-1/2 flex flex-col items-center bg-paper px-4 py-8 sm:px-8 sm:py-12 lg:px-14">
          <div className="w-full max-w-md my-auto">
            {/* Brand (phones and tablets) */}
            <div className="lg:hidden mb-6 flex items-center justify-center gap-2.5">
              <Image src="/images/logo.svg" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
              <span className="font-display text-xl font-semibold text-ink">Reclaim Pay</span>
            </div>

            <div className="rounded-card border border-line bg-surface p-5 sm:p-8">
              <div className="mb-6">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink">Sign in to Reclaim Pay</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  Try a demo account, or sign in with your email and password.
                </p>
              </div>

              {/* Demo sign-in */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => handleDemoLogin("employee")}
                  disabled={isValidating}
                  className={secondaryButtonClass}
                >
                  <Users className="w-4 h-4 text-ink-muted" aria-hidden />
                  Sign in as Employee
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin("hr")}
                  disabled={isValidating}
                  className={secondaryButtonClass}
                >
                  <Users className="w-4 h-4 text-ink-muted" aria-hidden />
                  Sign in as HR
                </button>
              </div>

              <div className="mb-6 flex items-center gap-3 text-sm text-ink-muted">
                <span aria-hidden className="h-px flex-1 bg-line" />
                or with your email
                <span aria-hidden className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {demoBanner && !error && (
                  <div role="status" className="rounded-control border border-line bg-surface-muted p-3 text-sm text-ink">
                    Signing in to the {demoBanner === "hr" ? "HR" : "employee"} demo account...
                  </div>
                )}
                {error && (
                  <div role="alert" className="rounded-control border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-ink" htmlFor="email">Email</label>
                  <input
                    className={inputClass}
                    id="email"
                    placeholder="name@company.com"
                    type="email"
                    autoComplete="email"
                    aria-invalid={form.formState.errors.email ? true : undefined}
                    aria-describedby={form.formState.errors.email ? "email-error" : undefined}
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p id="email-error" className="text-sm text-danger">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-ink" htmlFor="password">Password</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="-my-2 -mr-2 inline-flex min-h-11 items-center rounded-control px-2 text-sm font-medium text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-12`}
                      id="password"
                      placeholder="Your password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      aria-invalid={form.formState.errors.password ? true : undefined}
                      aria-describedby={form.formState.errors.password ? "password-error" : undefined}
                      {...form.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p id="password-error" className="text-sm text-danger">{form.formState.errors.password.message}</p>
                  )}
                  <div aria-live="polite">
                    {restrictionToast && (
                      <p role="status" className="pt-1 text-sm text-ink-muted">
                        {restrictionToast}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-control bg-accent px-6 py-3 text-base font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="w-5 h-5" aria-hidden />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 border-t border-line pt-6">
                {/* A plain link: this route handler redirects to PayPal, so client-side navigation and prefetch must stay off it. */}
                <a
                  href="/login/paypal/start"
                  aria-disabled={openingPayPal}
                  onClick={(event) => {
                    if (openingPayPal) event.preventDefault();
                    setOpeningPayPal(true);
                  }}
                  className={`${secondaryButtonClass} w-full aria-disabled:opacity-60`}
                >
                  <PayPalMark className="w-5 h-5 shrink-0" />
                  {openingPayPal ? "Opening PayPal..." : "Sign in with PayPal"}
                </a>
                <p className="mt-2 text-center text-sm text-ink-muted">
                  For employees who have already linked PayPal in Settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
