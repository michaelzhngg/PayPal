// ─── Autonomy fixtures ───────────────────────────────────────────────────────
// Settings, status, agent log and a back-test for fixture mode. The back-test
// replays 120 generated claims through the tier rules of DETAIL-PLAN §7.4, so the
// chart and tiles move when HR edits a limit, the way the real endpoint will.
// State is held in this module so the kill switch and saving work in a demo.
// Set RECLAIM_PAY_FIXTURE_BREAKER=1 on the server to start with the breaker tripped.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  AgentAction,
  AgentActionsResult,
  AutonomyConfig,
  AutonomySettings,
  AutonomyStatus,
  AutonomyTier,
  BacktestResult,
} from "@/lib/api/reclaim-pay-types";
import { payoutS1 } from "./reclaimPayFixtures";
import { FIXTURE_HR_USER_ID } from "./triageFixtures";

const FIXTURE_ACTOR_DANIEL = "3b9c1d2e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

export const DEFAULT_CONFIG: AutonomyConfig = {
  enabled: true,
  currency: "MYR",
  auto_limit_new: 50,
  auto_limit_standard: 100,
  auto_limit_trusted: 200,
  dual_approval_above: 1000,
  employee_daily_cap: 300,
  employee_monthly_cap: 1000,
  agent_daily_budget: 2000,
  quick_min_score: 20,
  review_min_score: 50,
  dual_min_score: 80,
  review_cost: 15,
  review_minutes: 10,
  recovery_rate: 0.5,
  audit_sample_rate: 0.05,
  payee_cooldown_hours: 72,
  breaker_window: 20,
  breaker_high_ratio: 0.3,
  breaker_pause_minutes: 60,
  dispute_window_hours: 120,
  version: 1,
};

/** The standard limits the back-test sweeps (8 points, as the backend returns). */
export const CURVE_LIMITS = [25, 50, 75, 100, 150, 200, 300, 500];

// ─── Generated claim history ─────────────────────────────────────────────────

interface HistoricClaim {
  amount: number;
  score: number;
  trust: "NEW" | "STANDARD" | "TRUSTED";
  hasHigh: boolean;
  /** Turned out to be a bad claim (overpaid, duplicate, fabricated). */
  bad: boolean;
}

/** Small seeded PRNG (mulberry32) so every run sees the same history. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHistory(): HistoricClaim[] {
  const rand = prng(20261102);
  const claims: HistoricClaim[] = [];
  for (let i = 0; i < 120; i++) {
    // Most claims are small; a long tail runs past MYR 1,000.
    const amount = Math.round(8 * Math.exp(rand() * 4.9) * 100) / 100;
    const r = rand();
    const score = r < 0.8 ? Math.round(rand() * 18) : r < 0.92 ? 20 + Math.round(rand() * 28) : 50 + Math.round(rand() * 45);
    const t = rand();
    const trust = t < 0.25 ? "NEW" : t < 0.75 ? "STANDARD" : "TRUSTED";
    const hasHigh = score >= 50 && rand() < 0.6;
    const bad = rand() < Math.min(0.9, 0.02 + score / 120);
    claims.push({ amount, score, trust, hasHigh, bad });
  }
  return claims;
}

const HISTORY = buildHistory();

function tierFor(c: HistoricClaim, cfg: AutonomyConfig): AutonomyTier {
  if (c.amount > cfg.dual_approval_above || c.score >= cfg.dual_min_score) return "DUAL_REVIEW";
  if (c.score >= cfg.review_min_score || c.hasHigh) return "HR_REVIEW";
  const limit =
    c.trust === "NEW" ? cfg.auto_limit_new : c.trust === "TRUSTED" ? cfg.auto_limit_trusted : cfg.auto_limit_standard;
  if (c.amount > limit || c.score >= cfg.quick_min_score) return "HR_QUICK";
  return "AUTO_PAY";
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

function summarise(cfg: AutonomyConfig) {
  const byTier: Record<AutonomyTier, number> = { AUTO_PAY: 0, HR_QUICK: 0, HR_REVIEW: 0, DUAL_REVIEW: 0 };
  let autoAmount = 0;
  let leakage = 0;
  let badAuto = 0;
  let caught = 0;
  for (const c of HISTORY) {
    const tier = tierFor(c, cfg);
    byTier[tier] += 1;
    if (tier === "AUTO_PAY") {
      autoAmount += c.amount;
      const pBad = Math.min(1, 0.01 + c.score / 200);
      leakage += pBad * c.amount * (1 - cfg.recovery_rate);
      if (c.bad) badAuto += 1;
    } else if (c.bad) {
      caught += 1;
    }
  }
  return { byTier, autoAmount, leakage, badAuto, caught };
}

export function fixtureBacktest(cfg: AutonomyConfig): BacktestResult {
  const s = summarise(cfg);
  const total = HISTORY.length;
  const auto = s.byTier.AUTO_PAY;
  return {
    total_claims: total,
    auto_paid_count: auto,
    automation_rate: round(auto / total, 3),
    auto_paid_amount: round(s.autoAmount),
    bad_auto_paid_count: s.badAuto,
    projected_leakage: round(s.leakage, 1),
    caught_bad_count: s.caught,
    hr_reviews_avoided: auto,
    hr_hours_saved: round((auto * cfg.review_minutes) / 60, 1),
    by_tier: s.byTier,
    curve: CURVE_LIMITS.map((limit) => {
      const p = summarise({ ...cfg, auto_limit_standard: limit });
      return {
        auto_limit_standard: limit,
        automation_rate: round(p.byTier.AUTO_PAY / total, 3),
        projected_leakage: round(p.leakage, 1),
      };
    }),
    assumptions: ["ignores daily budget and circuit breaker"],
  };
}

// ─── Mutable demo state ──────────────────────────────────────────────────────

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

interface FixtureState {
  config: AutonomyConfig;
  version: number;
  breakerUntil: string | null;
  actions: AgentAction[];
}

let nextActionId = 40;
let lastHash = "0".repeat(64);

function action(
  type: AgentAction["action_type"],
  actor: string,
  payload: Record<string, unknown>,
  reimId: string | null = null,
  minutesAgo = 0,
): AgentAction {
  nextActionId += 1;
  // Sample values shaped like the real sha256 chain. Nothing verifies them in fixture mode.
  const hash = (Math.imul(nextActionId, 2654435761) >>> 0).toString(16).padStart(8, "0").repeat(8);
  const prevHash = lastHash;
  lastHash = hash;
  return {
    action_id: nextActionId,
    action_type: type,
    actor,
    reim_id: reimId,
    payload,
    prev_hash: prevHash,
    hash,
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

/** The agent log a demo opens with, oldest first, matching the S1 and S8 claims. */
function seedActions(): AgentAction[] {
  const s1 = payoutS1.reim_id;
  const s8 = "d6f5b4c3-0e9a-4f81-82bd-4e5f6a7b8c93";
  return [
    action("DECISION", "agent", { tier: "AUTO_PAY", risk_score: 4, hard_stops: [], signals: [], config_version: 1 }, s1, 190),
    action("PAYOUT_CREATED", "agent", { amount: "48.00", currency: "MYR", sender_batch_id: "RC-5c2e8f10-1", batch_id: "MOCKB-5C2E8F104A3B" }, s1, 189),
    action("PAYOUT_STATUS", "agent", { from: "ACCEPTED", to: "SUCCEEDED", paypal_status: "SUCCESS", item_id: "MOCKI-5C2E8F104A3B" }, s1, 188),
    action("DECISION", "agent", { tier: "AUTO_PAY", risk_score: 8, hard_stops: [], signals: [], config_version: 1 }, s8, 60),
    action("PAYOUT_CREATED", "agent", { amount: "64.00", currency: "MYR", sender_batch_id: "RC-d6f5b4c3-1", batch_id: "MOCKB-D6F5B4C39E0A" }, s8, 59),
    action("HR_APPROVAL", FIXTURE_HR_USER_ID, { tier: "HR_QUICK", approvals: 1, required: 1, complete: true, batch: false, amount: 48 }, "c5e4a3b2-9d8f-4e70-b1ac-3d4e5f6a7b82", 40),
    action("RECOVERY_STATUS", FIXTURE_ACTOR_DANIEL, { recovery_id: "fa000004-0000-4000-8000-000000000004", from: "NOTICE_SENT", to: "DISPUTED" }, "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", 25),
    action("CONFIG_CHANGED", FIXTURE_HR_USER_ID, { version: 1, changed: ["auto_limit_standard"], old: { auto_limit_standard: 80 }, new: { auto_limit_standard: 100 }, reason: "Raising the standard limit after the Q3 audit" }, null, 15),
  ];
}

function initialState(): FixtureState {
  const breaker = process.env.RECLAIM_PAY_FIXTURE_BREAKER === "1";
  const actions: AgentAction[] = process.env.RECLAIM_PAY_FIXTURE_PAYOUTS === "empty" ? [] : seedActions().reverse();
  if (breaker) {
    actions.unshift(action("BREAKER_TRIPPED", "agent", {
      reason: "6 of the last 20 decisions had a HIGH signal.",
      until: minutesFromNow(42),
    }));
  }
  return {
    config: { ...DEFAULT_CONFIG },
    version: 1,
    breakerUntil: breaker ? minutesFromNow(42) : null,
    actions,
  };
}

const state: FixtureState = initialState();

function settingsOut(): AutonomySettings {
  return {
    config: { ...state.config, version: state.version },
    enabled: state.config.enabled,
    version: state.version,
    breaker_until: state.breakerUntil,
  };
}

export function fixtureSettings(): AutonomySettings {
  return settingsOut();
}

export function fixtureSaveSettings(next: AutonomyConfig, reason: string): AutonomySettings {
  const changed = (Object.keys(next) as (keyof AutonomyConfig)[]).filter(
    (k) => k !== "enabled" && k !== "version" && next[k] !== state.config[k],
  );
  state.config = { ...next, enabled: state.config.enabled };
  state.version += 1;
  state.actions.unshift(action("CONFIG_CHANGED", FIXTURE_HR_USER_ID, { version: state.version, changed, reason }));
  return settingsOut();
}

export function fixtureKillSwitch(enabled: boolean, reason: string): AutonomySettings {
  const previous = state.config.enabled;
  state.config = { ...state.config, enabled };
  state.actions.unshift(action("KILL_SWITCH", FIXTURE_HR_USER_ID, { enabled, previous, reason }));
  return settingsOut();
}

export function fixtureStatus(): AutonomyStatus {
  return {
    enabled: state.config.enabled,
    breaker_until: state.breakerUntil,
    auto_paid_today: 148,
    agent_daily_budget: state.config.agent_daily_budget,
    decisions_today_by_tier: { AUTO_PAY: 3, HR_QUICK: 2, HR_REVIEW: 1, DUAL_REVIEW: 4 },
  };
}

/** RECLAIM_PAY_FIXTURE_CHAIN=broken shows the agent log's tamper warning. */
export function fixtureActions(limit: number): AgentActionsResult {
  return { chain_valid: process.env.RECLAIM_PAY_FIXTURE_CHAIN !== "broken", actions: state.actions.slice(0, limit) };
}

export function fixtureActorNames(): Record<string, string> {
  return { [FIXTURE_HR_USER_ID]: "Demo HR", [FIXTURE_ACTOR_DANIEL]: "Daniel Lim" };
}

export function recordFixtureAction(
  type: AgentAction["action_type"],
  actor: string,
  reimId: string | null,
  payload: Record<string, unknown>,
): void {
  state.actions.unshift(action(type, actor, payload, reimId));
}
