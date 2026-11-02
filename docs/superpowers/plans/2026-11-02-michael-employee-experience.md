# Michael — Employee Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the employee side its demo moments: a live agent timeline while the claim is checked, a money-flow strip that ends in their PayPal account, PayPal account linking, and a "fast-track" trust card. Also ship the shared frontend contracts and fixtures on Day 0.

**Architecture:** Everything is built against fixtures first (`NEXT_PUBLIC_RECLAIM_PAY_FIXTURES=1`), then switched to real endpoints. Server actions follow the existing `"use server"` + `apiGet/apiPost` pattern in `lib/actions/claims.ts`. Pure logic (the timeline reducer, flow states) gets vitest tests. Screens are checked in the browser.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, framer-motion, lucide-react, vitest; Bryntum Calendar trial (stretch).

**Spec:** `docs/superpowers/specs/2026-11-02-reclaim-pay-hackathon-design.md` (Contracts → Frontend, Timeline over SSE, Demo scenarios)

**Execution:** Native (`superpowers:executing-plans`). Use `/antislop` and `antislop-ui` while coding, and `antislop-layoutmobile` for the 375px checks.

## Global Constraints

- **Employees never see which check flagged them.** For any tier other than AUTO_PAY, the copy is generic: "Sent to HR for a quick check." (HR_QUICK) or "Sent to HR for review." (HR_REVIEW and DUAL_REVIEW). In the `employee` audience, shield steps with status `warn` render as `done`, with no detail. This stops the timeline from teaching someone how to beat the checks.
- Show the currency and amount exactly as the backend sends them, e.g. `MYR 48.00`.
- Every new screen works at 375px wide with no horizontal scroll, and the timeline list has `aria-live="polite"`.
- You own `package.json` and the lockfile. Teammates ask you to add dependencies.
- Don't edit `app/hr/**`; that's Christian's.

## Review Focus

- **The SSE stream drops mid-analysis** (proxy timeout). The timeline must show a recoverable state and fall back to polling the claim, not hang forever.
- **A claim is split across two policies** (the backend returns two reimbursements). The decision card must show both, not just the first.
- **The PayPal callback returns `?paypal=error`.** Show a clear message and keep the "Connect" button.
- **The payout stays `REQUESTED`** (sandbox delay) past the 2-minute poll. Show "PayPal is still processing" and stop polling, without an error.
- **A user lands on a page from a push notification while logged out.** The existing role guards must still apply to the new pages.

---

### Task 1 (Day 0): Frontend contracts, fixtures, action stubs and dependencies

**Files:**
- Create: `frontend/lib/api/reclaim-pay-types.ts`, `frontend/lib/api/fixtures.ts`, `frontend/src/mocks/reclaimPayFixtures.ts`
- Create: `frontend/lib/actions/paypal.ts`, `frontend/lib/actions/autonomy.ts`, `frontend/lib/actions/recoveries.ts` (Christian owns the last two from Day 1)
- Modify: `frontend/package.json` and the lockfile
- Create: `frontend/vitest.config.ts`
- Test: `frontend/src/mocks/reclaimPayFixtures.test.ts`

**Interfaces:**
- Produces:
  - Types: `AutonomyTier`, `TrustTier`, `Severity`, `SignalCode`, `HardStop`, `RiskSignal`, `AutonomyDecision`, `TimelineEvent`, `TimelineStepId`, `AutonomyConfig`, `AutonomySettings`, `AutonomyStatus`, `BacktestResult`, `TrustInfo`, `PayeeStatus`, `PayoutInfoV2`, `PayoutLedgerRow`, `Recovery`, `AgentActionRow`. The fields mirror the spec exactly.
  - `withFixture<T>(fixture: T, real: () => Promise<T>): Promise<T>`
  - In `paypal.ts`: `getPayeeStatus()`, `getConnectUrl()`, `unlinkPayPal()`, `getPayout(reimId)`
  - In `autonomy.ts`: `getSettings()`, `saveSettings(cfg)`, `setKillSwitch(enabled, reason)`, `getStatus()`, `runBacktest(cfg)`, `getMyTrust()`, `getActions()`, `batchApprove(ids)`
  - In `recoveries.ts`: `listRecoveries(status?)`, `createRecovery(input)`, `disputeRecovery(id, note)`, `getInvoicePreview(id)`, `executeRecovery(id)`, `waiveRecovery(id)`
  - Fixtures: `timelineS1`, `timelineS4`, `decisions` (keyed `S1`–`S8`), `ledgerRows`, `settings`, `status`, `backtest`, `trust`, `payee`, `recoveries`, `actions`

- [ ] **Step 1: Install dependencies**

Run: `cd frontend && npm i ag-grid-react ag-grid-community ag-charts-react ag-charts-community && npm i -D vitest`

Add the script `"test": "vitest run"`. `vitest.config.ts` uses the `node` environment and resolves `@/` to the frontend root.

- [ ] **Step 2: Write the failing fixture test**

```ts
import { describe, it, expect } from "vitest";
import { timelineS1, timelineS4, decisions } from "./reclaimPayFixtures";

describe("fixtures follow the spec", () => {
  it("S1 runs every step in spec order and ends in AUTO_PAY", () => {
    expect(timelineS1.filter(e => e.status === "done").map(e => e.step)).toEqual([
      "policy.load", "receipt.analyze", "shield.injection", "shield.duplicate", "shield.provenance",
      "shield.arithmetic", "shield.split", "totals.aggregate", "judgment.final", "autonomy.decide", "payout.create"]);
    expect(decisions.S1.tier).toBe("AUTO_PAY");
  });
  it("S4 warns on injection and needs two people", () => {
    expect(timelineS4.find(e => e.step === "shield.injection")?.status).toBe("warn");
    expect(decisions.S4.tier).toBe("DUAL_REVIEW");
  });
  it("every tier appears in the demo decisions", () => {
    expect(new Set(Object.values(decisions).map(d => d.tier)))
      .toEqual(new Set(["AUTO_PAY", "HR_QUICK", "HR_REVIEW", "DUAL_REVIEW"]));
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails.** Run `npm test`; expect the module to be missing.

- [ ] **Step 4: Write the types, fixtures, `withFixture` and action stubs**

- The fixture labels match what Filbert's backend emits. S1's `autonomy.decide` detail reads: `"Auto-pay — risk 0/100, Standard employee limit MYR 100.00."`
- Every action calls the real endpoint from the spec's HTTP table, wrapped in `withFixture`.
- Copy the pattern from `getClaims` in `lib/actions/claims.ts`.

- [ ] **Step 5: Verify.** Run `npm test && npm run lint && npm run build`; expect the tests to pass and the build to succeed.

- [ ] **Step 6: Commit and include it in the Day-0 contracts PR** (`feat(contracts): frontend types, fixtures and action stubs`)

---

### Task 2 (Day 1): Live agent timeline

**Files:**
- Create: `frontend/lib/hooks/useTimeline.ts`, `frontend/components/timeline/AgentTimeline.tsx`, `frontend/components/timeline/DecisionCard.tsx`, `frontend/components/timeline/copy.ts`
- Create: `frontend/app/employee/timeline-preview/page.tsx`. It renders only when the fixtures flag is on and calls `notFound()` otherwise. It's also Darrell's fallback for the video.
- Modify: `frontend/app/employee/claims/page.tsx`. In the analyze phase (around lines 766–800, where `subscribeToProgress(taskId, "reimbursements", …)` runs), render `AgentTimeline`.
- Test: `frontend/lib/hooks/useTimeline.test.ts`

**Interfaces:**
- Consumes: `subscribeToProgress` from `lib/sse.ts`. Timeline events arrive through `onProgress` with `stage === "timeline"`.
- Produces:
  - `reduceTimeline(steps: TimelineStepState[], ev: TimelineEvent, audience: "employee" | "hr"): TimelineStepState[]`
  - `useTimeline(taskId: string | null, opts?: { replay?: TimelineEvent[]; speedMs?: number; audience?: "employee" | "hr" }): { steps; decisions: AutonomyDecision[]; done: boolean; error: string | null }`
  - `employeeTierCopy(tier: AutonomyTier, amount: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { reduceTimeline } from "./useTimeline";
import { employeeTierCopy } from "@/components/timeline/copy";

const ev = (step: string, status: string, detail: string | null = null) =>
  ({ stage: "timeline", step, label: step, status, detail, ts: "2026-11-03T10:00:00Z" }) as any;

describe("reduceTimeline", () => {
  it("keeps first-seen order and lets the latest status win", () => {
    let s = reduceTimeline([], ev("policy.load", "running"), "employee");
    s = reduceTimeline(s, ev("receipt.analyze", "running"), "employee");
    s = reduceTimeline(s, ev("policy.load", "done"), "employee");
    expect(s.map(x => [x.step, x.status])).toEqual([["policy.load", "done"], ["receipt.analyze", "running"]]);
  });
  it("hides shield warnings from employees but not from HR", () => {
    const e = reduceTimeline([], ev("shield.injection", "warn", "matched: SYSTEM:"), "employee");
    expect(e[0]).toMatchObject({ status: "done", detail: null });
    const h = reduceTimeline([], ev("shield.injection", "warn", "matched: SYSTEM:"), "hr");
    expect(h[0]).toMatchObject({ status: "warn", detail: "matched: SYSTEM:" });
  });
});

describe("employeeTierCopy", () => {
  it("never reveals review reasons", () => {
    expect(employeeTierCopy("AUTO_PAY", "MYR 48.00")).toBe("Approved automatically. Sending MYR 48.00 to your PayPal.");
    expect(employeeTierCopy("HR_QUICK", "MYR 48.00")).toBe("Sent to HR for a quick check.");
    expect(employeeTierCopy("HR_REVIEW", "MYR 48.00")).toBe("Sent to HR for review.");
    expect(employeeTierCopy("DUAL_REVIEW", "MYR 48.00")).toBe("Sent to HR for review.");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement the hook, reducer, copy and components**

- Each step row shows an icon for its status (spinner, check, amber triangle, red cross) and the label, with the detail in muted text. Rows animate in with framer-motion.
- `DecisionCard` shows the tier pill and `employeeTierCopy` for each reimbursement in the `complete` event.
- With `replay`, events are fed on a timer (`speedMs`, default 450). This is for the preview page and the demo.
- If the SSE errors or goes silent for 20 seconds, fall back to polling `getRawReimbursement` every 3 seconds.

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Check in the browser**

With `NEXT_PUBLIC_RECLAIM_PAY_FIXTURES=1 npm run dev`, open `/employee/timeline-preview`.

Expected: S1 replays 11 steps and ends with "Approved automatically…". Switching the preview to the HR audience shows S4's injection warning. Check at 375px wide.

- [ ] **Step 6: Commit** (`feat(employee): live agent timeline`)

---

### Task 3 (Day 2): Money flow and payout status

**Files:**
- Create: `frontend/components/timeline/MoneyFlow.tsx`, `frontend/lib/hooks/usePayoutStatus.ts`, `frontend/components/timeline/flow.ts`
- Modify: `frontend/app/employee/claims/_components/SuccessModal.tsx`, `frontend/app/employee/history/_components/ClaimSidebar.tsx`
- Test: `frontend/components/timeline/flow.test.ts`

**Interfaces:**
- Consumes: `getPayout(reimId)` from `lib/actions/paypal.ts`
- Produces:
  - `flowState(tier: AutonomyTier, payoutStatus: string | null): NodeState[]`. The five nodes are Receipt read, Policy checked, Guardrails, PayPal, In your account. A node's state is one of `done | active | waiting | error | pending`.
  - `usePayoutStatus(reimId: string | null): { status: string | null; payout: PayoutInfoV2 | null; timedOut: boolean }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { flowState } from "./flow";

describe("flowState", () => {
  it("auto-pay in flight", () => expect(flowState("AUTO_PAY", "REQUESTED")).toEqual(["done", "done", "done", "active", "pending"]));
  it("paid", () => expect(flowState("AUTO_PAY", "SUCCEEDED")).toEqual(["done", "done", "done", "done", "done"]));
  it("waiting for HR", () => expect(flowState("HR_REVIEW", null)).toEqual(["done", "done", "waiting", "pending", "pending"]));
  it("payout failed", () => expect(flowState("AUTO_PAY", "FAILED")).toEqual(["done", "done", "done", "error", "pending"]));
  it("approved by HR, then paid", () => expect(flowState("HR_QUICK", "SUCCEEDED")).toEqual(["done", "done", "done", "done", "done"]));
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement**

- Poll every 3 seconds until the status is SUCCEEDED, FAILED, REVERSED or CANCELLED, or 2 minutes have passed.
- The final node says "MYR 48.00 in your PayPal" with the masked email from `getPayeeStatus`.

- [ ] **Step 4: Run the tests, then check in the browser:** fixture S1 animates to "In your account", and fixture S2 shows "With HR".

- [ ] **Step 5: Commit** (`feat(employee): money flow and payout status`)

---

### Task 4 (Day 2): Connect PayPal in settings

**Files:**
- Create: `frontend/app/employee/settings/_components/PayPalConnectCard.tsx`
- Modify: `frontend/app/employee/settings/legacy-content.tsx`. Replace the bank-details section (search for `getBankingDetails`) with `PayPalConnectCard`.

- [ ] **Step 1: Implement the card states**

| State | What the card shows |
|---|---|
| Not linked | A "Connect PayPal" button that calls `getConnectUrl()` and sets `window.location` |
| Linked and verified | A green badge with the masked email and "Instant payouts on" |
| In cool-down | An amber notice: "Payout account changed. Instant payouts resume {time}." |
| Linked but unverified | "Verify your PayPal account to get instant payouts" |

Read `?paypal=linked` or `?paypal=error` once and show a toast, then clean the URL.

- [ ] **Step 2: Check in the browser.** With fixtures, cycle through all four states via the fixture `payee` variants. Against the sandbox, linking a personal sandbox account returns `?paypal=linked` and shows the green badge.

- [ ] **Step 3: Commit** (`feat(employee): connect PayPal for instant payouts`)

---

### Task 5 (Day 2–3): Fast-track card and recovery notice

**Files:**
- Create: `frontend/app/employee/dashboard/_components/FastTrackCard.tsx`, `frontend/app/employee/dashboard/_components/RecoveryNotice.tsx`
- Modify: `frontend/app/employee/dashboard/page.tsx`

- [ ] **Step 1: Implement**

- **FastTrackCard** (`getMyTrust()`): shows the trust tier, "Instant payouts up to {currency} {auto_limit}", a progress bar ("2 more approved claims to Trusted, up to MYR 200"), and the `reasons` text.
- **RecoveryNotice** (`listRecoveries("NOTICE_SENT")`): shows the amount, the reason, "You can dispute until {date}", and a dispute textarea that calls `disputeRecovery`. Open it automatically when `?recovery={id}` is in the URL.

- [ ] **Step 2: Check in the browser** with fixtures (a STANDARD employee, one open recovery). A dispute shows a "Disputed. HR will review." state.

- [ ] **Step 3: Commit** (`feat(employee): fast-track status and recovery notice`)

---

### Task 6 (Day 3, stretch, only if S1–S8 pass): Bryntum trips and payouts calendar

**Files:**
- Modify: `frontend/package.json`. Install Bryntum Calendar from the trial package following Bryntum's React guide; the core is aliased with `npm i @bryntum/calendar@npm:@bryntum/calendar-trial@latest`.
- Create: `frontend/app/employee/calendar/page.tsx` (client-only, loaded with `dynamic(..., { ssr: false })`)
- Modify: `frontend/app/employee/_components/SideNav.tsx`, `BottomNav.tsx`, `MobileNavDrawer.tsx` (add "Calendar")

- [ ] **Step 1: Implement.** Events come from `getRawReimbursements()`: "Submitted RC-xxxx" on `created_at`, colored by tier, and "Paid MYR 48.00" on the payout's `updated_at`. The trial watermark is acceptable.

- [ ] **Step 2: Check in the browser.** The month view shows the seeded claims. At 375px the calendar uses its list view.

- [ ] **Step 3: Commit** (`feat(employee): Bryntum trips and payouts calendar`)
