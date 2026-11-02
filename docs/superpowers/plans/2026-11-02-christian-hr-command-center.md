# Christian — HR Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give HR one place to see, act on and tune the automation: an AG Grid triage queue by tier, an evidence panel for each decision, an Autonomy page with a back-test chart and kill switch, and a payouts/audit/recovery ledger. Also refresh the landing page story.

**Architecture:** AG Grid Community and AG Charts Community, so no license is needed. Each grid's cell renderers live in `components/hr-grid/`. Data comes through server actions in `lib/actions/{hr,autonomy,recoveries}.ts`. Michael creates the last two on Day 0 with fixture fallbacks, and you own them from Day 1. Pure mapping and validation logic gets vitest tests.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, ag-grid-react, ag-charts-react, react-hook-form, zod, vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-reclaim-pay-hackathon-design.md` (D2, Contracts → HTTP API, Demo scenarios)

**Execution:** Native (`superpowers:executing-plans`). Use `/antislop` and `antislop-ui` while coding, and `antislop-copywriting` for Task 5.

## Global Constraints

- Use AG Grid Community features only (sorting, filtering, selection, custom cells, pagination). If you want row grouping, ask the team about an Enterprise trial key first; it's optional.
- Register modules once: `ModuleRegistry.registerModules([AllCommunityModule])`. Build the theme from `themeQuartz.withParams(...)` using the colors in `app/globals.css`.
- HR sees full evidence. Wording is factual ("Text on the receipt tried to instruct the AI. It was ignored."), never accusatory ("fraud").
- Saving autonomy settings or using the kill switch always goes through a confirm dialog that shows the change. The kill switch needs a reason.
- `app/hr/review/[id]/page.tsx` is 800 lines. Read it in ranges and insert the new panel with a minimal edit.
- Ask Michael for any new dependency.

## Review Focus

- **Approving a DUAL_REVIEW claim as the first HR user.** The UI must show "1 of 2 approvals" and must not claim the claim is approved.
- **Batch-approving rows that changed tier since the page loaded.** Show the backend's `skipped` list with its reasons.
- **Settings with limits out of order** (NEW above STANDARD) or score bands that overlap. Block saving, with a field message.
- **The kill switch toggled while the back-test is open.** The status banner must refresh, not show stale "Autonomy on".
- **The grid on a 375px screen.** Use a card list fallback below 640px instead of a sideways-scrolling grid.

---

### Task 1 (Day 1): Triage grid

**Files:**
- Create: `frontend/components/hr-grid/TriageGrid.tsx`, `frontend/components/hr-grid/cells/TierCell.tsx`, `RiskCell.tsx`, `SignalsCell.tsx`, `frontend/components/hr-grid/theme.ts`, `frontend/components/hr-grid/rows.ts`
- Modify: `frontend/lib/actions/hr.ts`. `getHRClaims` also returns `rows: TriageRow[]`.
- Modify: `frontend/app/hr/dashboard/page.tsx`. Replace the bucket lists with tier tabs and the grid.
- Test: `frontend/components/hr-grid/rows.test.ts`

**Interfaces:**
- Consumes: `ReimbursementRaw` plus the new fields `tier, risk_score, autonomy, audit_selected, approvals`, and `batchApprove(ids)` from `lib/actions/autonomy.ts`
- Produces:
  - `TriageRow { reimId, ref, employee, category, amount, currency, aiVerdict, confidence, tier, riskScore, signals: {code, severity}[], status, submittedAt, approvals: number }`
  - `toTriageRow(r: ReimbursementRaw): TriageRow`
  - `tierTabs(rows: TriageRow[]): Record<"all" | AutonomyTier, number>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { toTriageRow, tierTabs } from "./rows";

const raw = (over = {}) => ({ reim_id: "1a2b3c4d-0000-0000-0000-000000000000", employee_name: "Aisyah", main_category: "Travel",
  total_claimed_amount: 48, currency: "MYR", judgment: "APPROVED", confidence: 0.95, status: "REVIEW",
  created_at: "2026-11-03T10:00:00Z", tier: "HR_QUICK", risk_score: 20, audit_selected: false, approvals: [],
  autonomy: { signals: [{ code: "SPLIT_CLAIM", severity: "MEDIUM", points: 20, message: "split" }] }, ...over }) as any;

describe("toTriageRow", () => {
  it("maps the tier fields and the short ref", () => {
    const r = toTriageRow(raw());
    expect(r.ref).toBe("RC-1a2b3c4d");
    expect(r.tier).toBe("HR_QUICK");
    expect(r.riskScore).toBe(20);
    expect(r.signals).toEqual([{ code: "SPLIT_CLAIM", severity: "MEDIUM" }]);
  });
  it("treats old claims without a tier as HR_REVIEW", () => {
    expect(toTriageRow(raw({ tier: null, autonomy: {} })).tier).toBe("HR_REVIEW");
  });
});

describe("tierTabs", () => {
  it("counts by tier", () => {
    const rows = [toTriageRow(raw()), toTriageRow(raw({ tier: "DUAL_REVIEW" })), toTriageRow(raw({ tier: "HR_QUICK" }))];
    expect(tierTabs(rows)).toMatchObject({ all: 3, HR_QUICK: 2, DUAL_REVIEW: 1, HR_REVIEW: 0, AUTO_PAY: 0 });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run `cd frontend && npm test`.

- [ ] **Step 3: Implement**

- Columns: Claim, Employee, Category, Amount, AI verdict (with confidence), Tier (pill), Risk (a bar from 0 to 100), Signals (chips colored by severity), Submitted, Status.
- Tabs filter with an external filter: All, Two-person, Review, Quick, Auto-paid today.
- Row selection is allowed only for `HR_QUICK` rows in `REVIEW`. "Approve selected (n)" calls `batchApprove` and shows the skipped list.
- Clicking a row opens `/hr/review/{reimId}`.
- Below 640px, show a card list instead of the grid.

- [ ] **Step 4: Run the tests, then check in the browser.** With `NEXT_PUBLIC_RECLAIM_PAY_FIXTURES=1`, the dashboard shows the S1–S8 rows. Select two HR_QUICK rows; the approve button shows "(2)".

- [ ] **Step 5: Commit** (`feat(hr): AG Grid triage queue by autonomy tier`)

---

### Task 2 (Day 2): Decision evidence on the review page

**Files:**
- Create: `frontend/app/hr/review/[id]/_components/AutonomyPanel.tsx`, `SignalEvidence.tsx`, `frontend/components/hr-grid/labels.ts`
- Modify: `frontend/app/hr/review/[id]/page.tsx`. Add one import, and render `<AutonomyPanel>` at the top of the evidence column.
- Test: `frontend/components/hr-grid/labels.test.ts`

**Interfaces:**
- Produces:
  - `hardStopLabel(code: HardStop): string`
  - `scoreBreakdown(d: AutonomyDecision): { label: string; points: number }[]`
  - `approvalProgress(approvals: unknown[], tier: AutonomyTier): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { hardStopLabel, scoreBreakdown, approvalProgress } from "./labels";

describe("labels", () => {
  it("plain-English hard stops", () => {
    expect(hardStopLabel("PAYEE_COOLDOWN")).toBe("PayPal account changed in the last 72 hours");
    expect(hardStopLabel("OVER_AUTO_LIMIT")).toBe("Above this employee's auto-pay limit");
    expect(hardStopLabel("AI_NOT_APPROVED")).toBe("AI did not recommend approval");
  });
  it("score breakdown lists confidence first, then signals", () => {
    const d = { confidence_points: 15, risk_score: 35,
      signals: [{ code: "ARITHMETIC_MISMATCH", severity: "MEDIUM", points: 20, message: "Items don't add up" }] } as any;
    expect(scoreBreakdown(d)).toEqual([{ label: "AI confidence", points: 15 }, { label: "Items don't add up", points: 20 }]);
  });
  it("dual approval progress", () => {
    expect(approvalProgress([{ hr_id: "a" }], "DUAL_REVIEW")).toBe("1 of 2 approvals. Another HR member must approve.");
    expect(approvalProgress([], "HR_REVIEW")).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement the panel**

The panel shows the tier pill, the explanation, the score breakdown as bars, and hard stops as chips. Each signal type gets its own evidence view:

| Signal | Evidence shown |
|---|---|
| `DUPLICATE_RECEIPT` | A link to the matched claim and the pHash distance |
| `AI_PROVENANCE` | "C2PA content credentials say this image was AI-generated" |
| `ARITHMETIC_MISMATCH` | A small table: items, tax, expected, printed |
| `PROMPT_INJECTION` | The matched snippets in monospace, plus "Text on the receipt tried to instruct the AI. It was ignored." |
| `SPLIT_CLAIM` | Links to the related claims and the combined amount |

For `DUAL_REVIEW`, show `approvalProgress`. If the current HR user already approved, disable the approve button with "You already approved".

- [ ] **Step 4: Run the tests, then check in the browser** with fixture S3, S4 and S5: each shows its evidence block.

- [ ] **Step 5: Commit** (`feat(hr): decision evidence panel`)

---

### Task 3 (Day 2): Autonomy page with back-test and kill switch

**Files:**
- Create: `frontend/app/hr/autonomy/page.tsx`, `frontend/components/hr-grid/BacktestChart.tsx`, `frontend/components/hr-grid/autonomySchema.ts`
- Modify: `frontend/app/hr/hr_components/SideNav.tsx`, `BottomNav.tsx`, `MobileNavDrawer.tsx` (add "Autonomy")
- Test: `frontend/components/hr-grid/autonomySchema.test.ts`

**Interfaces:**
- Consumes: `getSettings`, `saveSettings`, `setKillSwitch`, `getStatus`, `runBacktest` from `lib/actions/autonomy.ts`
- Produces: `autonomySchema` (zod), mirroring `AutonomyConfig`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { autonomySchema } from "./autonomySchema";
import { settings } from "@/src/mocks/reclaimPayFixtures";

describe("autonomySchema", () => {
  it("accepts the spec defaults", () => expect(autonomySchema.safeParse(settings.config).success).toBe(true));
  it("rejects limits out of order", () =>
    expect(autonomySchema.safeParse({ ...settings.config, auto_limit_new: 150 }).success).toBe(false));
  it("rejects overlapping score bands", () =>
    expect(autonomySchema.safeParse({ ...settings.config, review_min_score: 15 }).success).toBe(false));
  it("rejects rates outside 0..1", () =>
    expect(autonomySchema.safeParse({ ...settings.config, audit_sample_rate: 1.5 }).success).toBe(false));
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement**

- **Validation rules.** Limits must satisfy new ≤ standard ≤ trusted ≤ dual. Bands must satisfy quick < review < dual ≤ 100. Rates must be between 0 and 1.
- **Status banner.** Shows "Autonomy on" or "Paused: {reason}", the breaker state ("Paused until 14:20 — 6 of the last 20 claims were high-risk"), and today's auto-paid amount against the budget as a progress bar.
- **Form.** Uses react-hook-form and zod. "Preview impact" calls `runBacktest(formValues)`, debounced by 400 ms.
- **Chart.** `BacktestChart` is an AG Charts line chart. X is the standard limit; the left axis is automation %, and the right axis is projected leakage in the configured currency. A marker shows the current value.
- **KPI tiles.** Automation rate, HR hours saved, projected leakage, and risky claims caught.
- **Saving.** "Save" opens a confirm dialog listing each changed field (old → new) and the new version number.
- **Kill switch.** A large toggle with a required reason; afterwards the status refreshes.

- [ ] **Step 4: Run the tests, then check in the browser.** With fixtures, moving the standard limit from 100 to 200 updates the chart marker and tiles. An invalid form blocks saving.

- [ ] **Step 5: Commit** (`feat(hr): autonomy dial with back-test and kill switch`)

---

### Task 4 (Day 2–3): Payouts, audit, recoveries and the agent log

**Files:**
- Create: `frontend/app/hr/payouts/page.tsx`, `frontend/components/hr-grid/LedgerGrid.tsx`, `RecoveryDialog.tsx`, `InvoicePreviewDialog.tsx`, `AgentLogGrid.tsx`
- Modify: the HR navigation components (add "Payouts")

**Interfaces:**
- Consumes: `getPayout` and the ledger action (add `getLedger(filters)` to `lib/actions/autonomy.ts`), `listRecoveries`, `createRecovery`, `getInvoicePreview`, `executeRecovery`, `waiveRecovery`, `getActions`

- [ ] **Step 1: Implement four tabs**

| Tab | Contents |
|---|---|
| **Ledger** | Claim, employee, amount, status pill, tier, attempt, PayPal batch ID (click to copy), updated time. A filter for status. |
| **Audit queue** | Claims with `audit_selected`. "Record overpayment" opens `RecoveryDialog` (amount ≤ approved amount, reason required) and calls `createRecovery`. |
| **Recoveries** | Status, amount, "dispute until". Actions: "Preview invoice" (`InvoicePreviewDialog` shows the AI-drafted note, amount and masked email, plus a "Send via PayPal" button calling `executeRecovery`), and "Waive". DISPUTED rows show the employee's note. |
| **Agent log** | Time, action, actor, claim, hash prefix, and a badge from `chain_valid`: "Log intact" in green or "Log altered" in red. |

- [ ] **Step 2: Check in the browser** with fixture S8: the recovery row shows the window has passed, the invoice preview opens, and the agent log badge is green.

- [ ] **Step 3: Commit** (`feat(hr): payouts ledger, audit queue, recoveries and agent log`)

---

### Task 5 (Day 3): Landing page refresh

**Files:**
- Modify: `frontend/app/_components/landing/Hero.tsx`, `HowItWorks.tsx`, `FeaturesSection.tsx`
- Create: `frontend/app/_components/landing/BuiltWith.tsx`

- [ ] **Step 1: Implement**

- **Hero.** One line on the outcome ("Expense claims paid to PayPal in seconds, when it's safe"), plus one supporting line on guardrails.
- **HowItWorks.** Four steps: Snap the receipt → AI checks it against policy → Guardrails decide → PayPal pays.
- **Features.** Replace generic items with the Receipt Shield, the autonomy dial and recovery with due process.
- **BuiltWith.** Lists only tools that appear in the demo. Confirm the list with the team at the 12:00 Day 3 freeze.

- [ ] **Step 2: Check in the browser** at 375px and on desktop. There's no horizontal scroll and the motion respects `prefers-reduced-motion`.

- [ ] **Step 3: Commit** (`feat(landing): Reclaim Pay story`)
