"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Users } from "lucide-react";
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
    const timer = window.setTimeout(() => setRestrictionToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [restrictionToast]);

  const handleForgotPassword = () => {
    setRestrictionToast("Feature Restricted during MVP Stages");
  };

  return (
    <>
      <LoadingOverlay show={isLoading} />
      <main className="flex w-full min-h-dvh h-dvh overflow-hidden">
        {/* Left Side: Split Gradient Anchor */}
        <div className="hidden lg:flex w-1/2 split-gradient relative overflow-hidden items-center justify-center p-12 xl:p-16">
          {/* Decorative Elements */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(147,150,255,0.15),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(158,0,180,0.12),transparent_60%)] opacity-40 mix-blend-overlay"
          ></div>
          <div className="relative z-10 text-on-primary max-w-xl">
            <div className="flex items-center gap-4 mb-6">
              <Image src="/images/logo.svg" alt="" width={64} height={64} className="w-16 h-16 object-contain brightness-0 invert" priority />
              <h1 className="font-headline text-5xl xl:text-6xl font-extrabold tracking-tight leading-tight">
                Reclaim Pay
              </h1>
            </div>
            <p className="font-headline text-2xl xl:text-3xl font-bold leading-snug mb-4">
              Paid to your PayPal in seconds when it&apos;s safe.
            </p>
            <p className="text-base xl:text-lg opacity-90 leading-relaxed max-w-md text-left">
              Snap a receipt and we check it against your company&apos;s policy. Safe claims go straight to your PayPal. Anything unusual goes to HR, and a person makes the call.
            </p>
          </div>
          {/* Floating accent blobs */}
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-tertiary rounded-full blur-[120px] opacity-40"></div>
          <div className="absolute top-1/4 -right-24 w-72 h-72 bg-primary rounded-full blur-[100px] opacity-30"></div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_96%,rgba(255,255,255,0.09)_96%),linear-gradient(90deg,transparent_96%,rgba(255,255,255,0.09)_96%)] bg-[size:26px_26px] opacity-10"></div>
        </div>

        {/* Right Side: Interaction Canvas */}
        <div className="w-full lg:w-1/2 h-full flex flex-col items-center px-5 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-10 bg-surface overflow-y-auto">
          <div className="w-full max-w-md my-auto py-8">
            {/* Brand Header (Mobile Only) */}
            <div className="lg:hidden mb-6 flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex items-center gap-2.5">
                <Image src="/images/logo.svg" alt="" width={32} height={32} className="w-8 h-8 object-contain" />
                <h2 className="font-headline text-2xl font-black tracking-tighter text-primary">
                  Reclaim Pay
                </h2>
              </div>
              <p className="text-sm text-on-surface-variant">
                Paid to your PayPal in seconds when it&apos;s safe.
              </p>
            </div>

            <div className="glass-card rounded-[1.75rem] p-6 sm:p-8 shadow-ambient-lg border border-white/40">
              <div className="min-h-10 mb-1" aria-live="polite">
                {restrictionToast && (
                  <div role="status" className="rounded-xl border border-tertiary/20 bg-surface-container-lowest/95 px-4 py-2.5 text-center text-xs font-semibold text-tertiary shadow-sm">
                    {restrictionToast}
                  </div>
                )}
              </div>

              <div className="mb-7 text-center">
                <h2 className="font-headline text-3xl font-bold tracking-tight text-on-surface mb-3">
                  Welcome to Reclaim Pay
                </h2>
                <p className="text-on-surface-variant text-sm">
                  Pick a demo account, or sign in with your email.
                </p>
              </div>

              {/* Demo Login Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => handleDemoLogin("employee")}
                  disabled={isValidating}
                  className="flex-1 min-h-11 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-primary/20 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 hover:border-primary/30 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4" aria-hidden />
                  Sign in as Employee
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin("hr")}
                  disabled={isValidating}
                  className="flex-1 min-h-11 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-primary/20 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 hover:border-primary/30 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4" aria-hidden />
                  Sign in as HR
                </button>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {demoBanner && !error && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center text-xs font-semibold text-primary">
                    Signing in as {demoBanner === "hr" ? "HR" : "Employee"} demo…
                  </div>
                )}
                {error && <div role="alert" className="bg-error-container text-on-error-container p-3 rounded-lg text-sm text-center">{error}</div>}

                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="email">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant group-focus-within:text-primary transition-colors w-5 h-5" />
                    <input className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest/60 backdrop-blur-md border border-outline/20 rounded-xl text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm" id="email" placeholder="name@company.com" type="email" {...form.register("email")} />
                    {form.formState.errors.email && <p className="text-error text-xs mt-1">{form.formState.errors.email.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="password">Password</label>
                    <button type="button" onClick={handleForgotPassword} className="text-xs font-semibold text-primary hover:text-primary-dim hover:underline decoration-primary/30 underline-offset-4 transition-all">Forgot Password?</button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant group-focus-within:text-primary transition-colors w-5 h-5" />
                    <input className="w-full pl-12 pr-12 py-3.5 bg-surface-container-lowest/60 backdrop-blur-md border border-outline/20 rounded-xl text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm" id="password" placeholder="••••••••" type={showPassword ? "text" : "password"} {...form.register("password")} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    {form.formState.errors.password && <p className="text-error text-xs mt-1">{form.formState.errors.password.message}</p>}
                  </div>
                </div>

                <button className="w-full mt-8 py-4 px-6 bg-gradient-to-r from-primary to-primary-dim text-white rounded-xl font-headline font-semibold text-lg hover:shadow-[0_0_20px_rgba(147,150,255,0.4)] active:scale-[0.98] transition-all duration-250 flex justify-center items-center gap-2 cursor-pointer" type="submit" disabled={isLoading || isValidating}>
                  {isLoading || isValidating ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <>Sign In <ArrowRight className="text-xl w-5 h-5" /></>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-outline-variant/30 text-center">
                {/* A plain link: this route handler redirects to PayPal, so client-side navigation and prefetch must stay off it. */}
                <a
                  href="/login/paypal/start"
                  aria-disabled={openingPayPal}
                  onClick={(event) => {
                    if (openingPayPal) event.preventDefault();
                    setOpeningPayPal(true);
                  }}
                  className="w-full min-h-11 flex items-center justify-center py-2.5 px-4 rounded-xl border border-outline text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {openingPayPal ? "Opening PayPal…" : "Sign in with PayPal"}
                </a>
                <p className="mt-2 text-xs text-on-surface-variant">
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
