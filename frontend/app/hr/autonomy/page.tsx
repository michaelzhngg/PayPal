"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Clock, Loader2, PauseCircle, RefreshCw } from "lucide-react";
import {
  getActions,
  getSettings,
  getStatus,
  runBacktest,
  saveSettings,
  setKillSwitch,
} from "@/lib/actions/autonomy";
import { FIXTURES_ON } from "@/lib/api/fixtures";
import type {
  AgentAction,
  AutonomyConfig,
  AutonomySettings,
  AutonomyStatus,
  BacktestResult,
} from "@/lib/api/reclaim-pay-types";
import {
  autonomySchema,
  breakerActive,
  budgetPercent,
  clockTime,
  diffConfig,
  latestReason,
  toChartData,
  type AutonomyFormValues,
} from "./_lib/autonomy";
import LimitsForm from "./_components/LimitsForm";
import { KillSwitchDialog, SaveDialog } from "./_components/Dialogs";
import { AUTONOMY_CHANGED_EVENT } from "../hr_components/AutonomyBanner";

// AG Charts draws on a canvas, so it only renders in the browser.
const BacktestChart = dynamic(() => import("./_components/BacktestChart"), {
  ssr: false,
  loading: () => <div className="h-[420px] rounded-xl bg-surface-container-low animate-pulse" aria-hidden="true" />,
});

const DEBOUNCE_MS = 400;

type BacktestState =
  | { kind: "idle" }
  | { kind: "loading"; previous: BacktestResult | null }
  | { kind: "ready"; result: BacktestResult }
  | { kind: "unavailable" }
  | { kind: "error"; message: string; previous: BacktestResult | null };

const money = (currency: string, n: number) => `${currency} ${Math.round(n).toLocaleString("en-US")}`;

// ─── Status strip ────────────────────────────────────────────────────────────

function StatusStrip({
  settings,
  status,
  statusError,
  pauseReason,
  breakerReason,
  onToggle,
  onRetryStatus,
}: {
  settings: AutonomySettings;
  status: AutonomyStatus | null;
  statusError: string | null;
  pauseReason: string | null;
  breakerReason: string | null;
  onToggle: () => void;
  onRetryStatus: () => void;
}) {
  const currency = settings.config.currency;
  const paused = !settings.enabled;
  const breakerUntil = status?.breaker_until ?? settings.breaker_until;
  const breaker = breakerActive(breakerUntil);
  const pct = status ? budgetPercent(status.auto_paid_today, status.agent_daily_budget) : 0;
  const tiers = status?.decisions_today_by_tier ?? {};

  return (
    <section
      aria-label="Auto-pay status"
      className={`rounded-2xl border px-4 py-4 sm:px-5 ${
        paused ? "border-error/40 bg-error/5" : "border-outline-variant/30 bg-surface-container-lowest"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-headline font-bold text-lg">
            {paused ? (
              <PauseCircle className="w-5 h-5 text-error shrink-0" aria-hidden="true" />
            ) : breaker ? (
              <Clock className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" aria-hidden="true" />
            )}
            {paused ? "Auto-pay paused" : breaker ? `Auto-pay on hold until ${clockTime(breakerUntil)}` : "Auto-pay on"}
          </p>
          {paused && (
            <p className="mt-1 text-sm text-on-surface">
              Every new claim waits for HR.{pauseReason ? <> Reason: {pauseReason}</> : null}
            </p>
          )}
          {!paused && breaker && (
            <div className="mt-1 text-sm text-on-surface max-w-prose">
              <p>The circuit breaker tripped: {breakerReason ?? "too many recent claims looked risky."}</p>
              <p className="mt-1 text-on-surface-variant">
                It trips by itself when too many of the last {settings.config.breaker_window} claims are high-risk, or
                more than {money(currency, 1000)} is auto-paid within an hour. Until {clockTime(breakerUntil)}, claims
                that would pay automatically go to quick HR approval instead. It lifts on its own; use the kill switch
                if you want a longer pause.
              </p>
            </div>
          )}

          {statusError ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              <AlertCircle className="w-4 h-4 text-error" aria-hidden="true" />
              Couldn&apos;t load today&apos;s totals.
              <button type="button" onClick={onRetryStatus} className="min-h-[44px] px-2 font-semibold text-primary rounded-lg focus-visible:outline-2 focus-visible:outline-primary cursor-pointer">
                Try again
              </button>
            </p>
          ) : status ? (
            <div className="mt-3 max-w-md">
              <p className="text-sm text-on-surface-variant">
                Auto-paid today{" "}
                <span className="font-semibold text-on-surface">{money(currency, status.auto_paid_today)}</span> of{" "}
                {money(currency, status.agent_daily_budget)} company budget
              </p>
              <div
                className="mt-1.5 h-2 rounded-full bg-primary/15 overflow-hidden"
                role="meter"
                aria-label="Company auto-pay budget used today"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <div className={`h-full rounded-full ${pct >= 90 ? "bg-error" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                Today: {tiers.AUTO_PAY ?? 0} auto-paid · {tiers.HR_QUICK ?? 0} quick approval · {tiers.HR_REVIEW ?? 0} HR
                review · {tiers.DUAL_REVIEW ?? 0} two-person
              </p>
            </div>
          ) : (
            <div className="mt-3 h-10 max-w-md rounded-lg bg-surface-container-low animate-pulse" aria-hidden="true" />
          )}
        </div>

        <div className="flex items-center gap-3 md:flex-col md:items-end shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={paused}
            aria-describedby="kill-switch-state"
            onClick={onToggle}
            className="group inline-flex items-center gap-3 min-h-[44px] rounded-xl px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error cursor-pointer"
          >
            <span className="font-semibold text-sm">Kill switch</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${
                paused ? "bg-error border-error" : "bg-surface-container-high border-error"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  paused ? "translate-x-[22px]" : "translate-x-[2px]"
                }`}
              />
            </span>
          </button>
          <p id="kill-switch-state" className="text-xs text-on-surface-variant">
            {paused ? "On: nothing pays automatically" : "Off: limits below apply"}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── KPI tiles ───────────────────────────────────────────────────────────────

function Tile({ label, value, was }: { label: string; value: string | null; was?: string | null }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 min-w-0">
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className="mt-1 font-headline font-bold text-2xl text-on-surface truncate">{value ?? "–"}</p>
      <p className="mt-0.5 text-xs text-on-surface-variant min-h-[1rem]">{was ? `Saved settings: ${was}` : null}</p>
    </div>
  );
}

function KpiTiles({
  result,
  baseline,
  currency,
  changed,
}: {
  result: BacktestResult | null;
  baseline: BacktestResult | null;
  currency: string;
  changed: boolean;
}) {
  const pct = (r: BacktestResult | null) => (r ? `${Math.round(r.automation_rate * 100)}%` : null);
  const hours = (r: BacktestResult | null) => (r ? `${r.hr_hours_saved.toLocaleString("en-US")} h` : null);
  const leak = (r: BacktestResult | null) => (r ? money(currency, r.projected_leakage) : null);
  const caught = (r: BacktestResult | null) => (r ? `${r.caught_bad_count} of ${r.caught_bad_count + r.bad_auto_paid_count}` : null);
  const was = (f: (r: BacktestResult | null) => string | null) => (changed && baseline ? f(baseline) : null);
  return (
    <section aria-label="Impact over the last 90 days" aria-live="polite" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile label="Paid automatically" value={pct(result)} was={was(pct)} />
      <Tile label="HR hours saved" value={hours(result)} was={was(hours)} />
      <Tile label="Expected leakage" value={leak(result)} was={was(leak)} />
      <Tile label="Risky claims caught" value={caught(result)} was={was(caught)} />
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AutonomyPage() {
  const [settings, setSettings] = useState<AutonomySettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<AutonomyStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);

  const [backtest, setBacktest] = useState<BacktestState>({ kind: "idle" });
  const [baseline, setBaseline] = useState<BacktestResult | null>(null);
  const [retry, setRetry] = useState(0);

  const [saveOpen, setSaveOpen] = useState(false);
  const [killOpen, setKillOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const form = useForm<AutonomyFormValues>({ resolver: zodResolver(autonomySchema), mode: "onChange" });
  const { register, control, reset, formState } = form;
  const values = useWatch({ control }) as AutonomyFormValues;

  const loadStatus = useCallback(
    () =>
      Promise.all([getStatus(), getActions(50)])
        .then(([s, a]) => {
          setStatus(s.status);
          setStatusError(s.error);
          if (a.result) setActions(a.result.actions);
        })
        .catch(() => setStatusError("Check your connection and try again.")),
    [],
  );

  const loadAll = useCallback(
    () =>
      getSettings()
        .then((res) => {
          if (!res.settings) return setLoadError(res.error ?? "No response from the server.");
          setLoadError(null);
          setSettings(res.settings);
          reset(res.settings.config);
          void loadStatus();
        })
        .catch(() => setLoadError("Check your connection and try again.")),
    [reset, loadStatus],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saved = settings?.config ?? null;
  const parsed = useMemo(() => (values ? autonomySchema.safeParse(values) : null), [values]);
  const candidate: AutonomyConfig | null = parsed?.success ? (parsed.data as AutonomyConfig) : null;
  const changes = useMemo(() => (saved && candidate ? diffConfig(saved, candidate) : []), [saved, candidate]);
  const dirtyKeys = useMemo(() => new Set<string>(changes.map((c) => c.key)), [changes]);
  const candidateKey = candidate ? JSON.stringify(candidate) : null;

  // Live back-test: re-run 400 ms after the last valid edit. Older answers are ignored.
  const requestId = useRef(0);
  useEffect(() => {
    if (!candidateKey || !saved) return;
    const config = JSON.parse(candidateKey) as AutonomyConfig;
    const isSaved = diffConfig(saved, config).length === 0;
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      setBacktest((b) => ({
        kind: "loading",
        previous: b.kind === "ready" ? b.result : b.kind === "loading" || b.kind === "error" ? b.previous : null,
      }));
      const res = await runBacktest(config);
      if (id !== requestId.current) return;
      if (res.unavailable) return setBacktest({ kind: "unavailable" });
      if (!res.result) {
        return setBacktest((b) => ({
          kind: "error",
          message: res.error ?? "The back-test didn't answer.",
          previous: b.kind === "loading" ? b.previous : null,
        }));
      }
      setBacktest({ kind: "ready", result: res.result });
      if (isSaved) setBaseline(res.result);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [candidateKey, saved, retry]);

  const announce = () => window.dispatchEvent(new Event(AUTONOMY_CHANGED_EVENT));

  async function confirmSave(reason: string) {
    if (!candidate || !settings) return;
    setBusy(true);
    setDialogError(null);
    const res = await saveSettings(candidate, reason);
    setBusy(false);
    if (!res.settings) return setDialogError(res.error);
    setSettings(res.settings);
    reset(res.settings.config);
    setSaveOpen(false);
    setNotice(`Saved version ${res.settings.version}. New claims use these limits now.`);
    void loadStatus();
    announce();
  }

  async function confirmKill(reason: string) {
    if (!settings) return;
    setBusy(true);
    setDialogError(null);
    const res = await setKillSwitch(!settings.enabled, reason);
    setBusy(false);
    if (!res.settings) return setDialogError(res.error);
    setSettings((s) => (s ? { ...s, enabled: res.settings!.enabled, breaker_until: res.settings!.breaker_until } : s));
    setKillOpen(false);
    setNotice(res.settings.enabled ? "Auto-pay is back on." : "Auto-pay is paused. New claims wait for HR.");
    void loadStatus();
    announce();
  }

  const openDialog = (which: "save" | "kill") => {
    setDialogError(null);
    setDialogKey((k) => k + 1);
    if (which === "save") setSaveOpen(true);
    else setKillOpen(true);
  };

  // ─── Render states ─────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-full px-4 py-6 sm:px-6 md:px-8 md:py-10">
        <PageHeader />
        <div role="alert" className="max-w-xl rounded-2xl border border-error/30 bg-error/5 px-5 py-6">
          <p className="flex items-center gap-2 font-semibold text-on-surface">
            <AlertCircle className="w-5 h-5 text-error" aria-hidden="true" />
            Couldn&apos;t load the autonomy settings.
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="mt-4 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-on-primary text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!settings || !saved) {
    return (
      <div className="min-h-full px-4 py-6 sm:px-6 md:px-8 md:py-10" aria-busy="true">
        <PageHeader />
        <p className="sr-only">Loading autonomy settings…</p>
        <div className="flex flex-col gap-4" aria-hidden="true">
          <div className="h-28 rounded-2xl bg-surface-container-low animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-container-low animate-pulse" />
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-surface-container-low animate-pulse" />
        </div>
      </div>
    );
  }

  const currency = saved.currency;
  const shown =
    backtest.kind === "ready" ? backtest.result : backtest.kind === "loading" || backtest.kind === "error" ? backtest.previous : null;
  const chartData = shown && candidate ? toChartData(shown, candidate.auto_limit_standard) : null;
  const hasErrors = Object.keys(formState.errors).length > 0;

  return (
    <div className="min-h-full px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <PageHeader />

      <div className="flex flex-col gap-4">
        <StatusStrip
          settings={settings}
          status={status}
          statusError={statusError}
          pauseReason={latestReason(actions, "KILL_SWITCH")}
          breakerReason={latestReason(actions, "BREAKER_TRIPPED")}
          onToggle={() => openDialog("kill")}
          onRetryStatus={() => void loadStatus()}
        />

        {notice && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <CheckCircle2 className="w-4 h-4 text-green-700" aria-hidden="true" />
            {notice}
          </p>
        )}

        {backtest.kind !== "unavailable" && (
          <KpiTiles result={shown} baseline={baseline} currency={currency} changed={changes.length > 0} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-4 items-start">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (changes.length && !hasErrors) openDialog("save");
            }}
            className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-5 sm:px-5"
            aria-labelledby="limits-title"
            noValidate
          >
            <h3 id="limits-title" className="sr-only">Limits and caps</h3>
            <LimitsForm register={register} errors={formState.errors} saved={saved} dirtyKeys={dirtyKeys} currency={currency} />

            <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-on-surface-variant" aria-live="polite">
                {hasErrors
                  ? "Fix the highlighted fields to see the impact and save."
                  : changes.length
                    ? `${changes.length} unsaved ${changes.length === 1 ? "change" : "changes"} · version ${settings.version} is live`
                    : `Version ${settings.version} is live`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reset(saved)}
                  disabled={!changes.length && !hasErrors}
                  className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
                >
                  Undo changes
                </button>
                <button
                  type="submit"
                  disabled={!changes.length || hasErrors}
                  className="min-h-[44px] px-4 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
                >
                  Review and save
                </button>
              </div>
            </div>
          </form>

          <section
            aria-labelledby="impact-title"
            className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-5 sm:px-5 lg:sticky lg:top-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="impact-title" className="font-headline font-bold text-base text-on-surface">
                  What these limits would have done
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  {shown
                    ? `The last 90 days, ${shown.total_claims} claims, replayed with the limits on the left.`
                    : "The last 90 days of claims, replayed with the limits on the left."}
                </p>
              </div>
              {backtest.kind === "loading" && (
                <Loader2 className="w-4 h-4 mt-1 animate-spin text-on-surface-variant shrink-0" aria-label="Updating" />
              )}
            </div>

            <div className="mt-4">
              {backtest.kind === "unavailable" ? (
                <div className="rounded-xl bg-surface-container-low px-4 py-6 text-sm">
                  <p className="font-semibold text-on-surface">Back-test unavailable</p>
                  <p className="mt-1 text-on-surface-variant">
                    This server can&apos;t replay past claims yet. You can still change and save limits; they apply to new
                    claims as usual.
                  </p>
                </div>
              ) : shown && shown.total_claims === 0 ? (
                <div className="rounded-xl bg-surface-container-low px-4 py-6 text-sm">
                  <p className="font-semibold text-on-surface">No claims to replay yet</p>
                  <p className="mt-1 text-on-surface-variant">
                    The back-test uses claims from the last 90 days. Once employees submit a few, their impact shows here.
                  </p>
                </div>
              ) : chartData ? (
                <div className={backtest.kind === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
                  <BacktestChart data={chartData} currency={currency} />
                </div>
              ) : backtest.kind === "error" ? null : (
                <div className="h-[420px] rounded-xl bg-surface-container-low animate-pulse" aria-hidden="true" />
              )}

              {backtest.kind === "error" && (
                <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-on-surface">
                  <AlertCircle className="w-4 h-4 text-error" aria-hidden="true" />
                  Couldn&apos;t run the back-test: {backtest.message}
                  <button
                    type="button"
                    onClick={() => setRetry((n) => n + 1)}
                    className="min-h-[44px] px-2 font-semibold text-primary rounded-lg focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
                  >
                    Try again
                  </button>
                </p>
              )}
              {hasErrors && shown && (
                <p className="mt-3 text-sm text-on-surface-variant">Showing the last valid limits until the form is fixed.</p>
              )}

              {shown && shown.assumptions.length > 0 && (
                <p className="mt-4 text-xs text-on-surface-variant">
                  {FIXTURES_ON ? "Sample data. " : ""}Assumptions: {shown.assumptions.join("; ")}.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      <SaveDialog
        key={`save-${dialogKey}`}
        open={saveOpen}
        nextVersion={settings.version + 1}
        changes={changes}
        busy={busy}
        error={dialogError}
        onConfirm={confirmSave}
        onClose={() => setSaveOpen(false)}
      />
      <KillSwitchDialog
        key={`kill-${dialogKey}`}
        open={killOpen}
        pausing={settings.enabled}
        busy={busy}
        error={dialogError}
        onConfirm={confirmKill}
        onClose={() => setKillOpen(false)}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <header className="mb-6 max-w-3xl">
      <h2 className="font-headline font-extrabold text-on-background text-3xl md:text-4xl tracking-tight">Autonomy</h2>
      <p className="text-on-surface-variant text-base font-body mt-2">
        Decide which claims Reclaim Pay pays to PayPal on its own, and see what each limit would have done to recent claims
        before you save it.
      </p>
    </header>
  );
}
