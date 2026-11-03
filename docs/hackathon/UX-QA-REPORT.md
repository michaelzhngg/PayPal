# Reclaim Pay — UX QA Report

**Tested:** 3 Nov 2026, 19:30. The local Docker stack, in mock PayPal mode, running branch `hackathon/reclaim-pay` at `91f2889`.
**How:** a headless Chromium walked through every employee and HR page at desktop (1440×900) and phone (390×844) sizes. It recorded console errors, failed requests and horizontal overflow, and saved full-page screenshots for review. Accounts used: `employee@example.com`, `liu.wei@reclaim.my` (has a paid claim) and `hr@example.com`.

**Severity**
- **P0:** confuses a judge or breaks a hackathon rule. Fix before Day 2 18:00.
- **P1:** visibly rough. Fix before the Day 3 freeze.
- **P2:** after the hackathon.

**Each finding carries one action**
- **Eliminate:** remove it.
- **Revamp:** change what's there.
- **Add:** something missing.

---

## 1. Findings on the current build

| # | Sev | Screen | Finding | Action |
|---|---|---|---|---|
| Q1 | P0 | Everywhere | The same claim shows its ID four ways: `RC-0299B` (HR history), `RC-0299bfab` (ledger), `0299bfab` (employee history), and the full UUID (review page title, and the "Employee No." field). Judges can't follow one claim across screens. | **Revamp:** one format, `RC-XXXXXXXX` in upper case, everywhere, using `formatClaimRef` in `frontend/lib/format.ts`. The backend ledger now matches. |
| Q2 | P0 | HR review → Claim Context | "Purpose" shows the AI's fraud summary ("High fraud risk: one receipt amount is 10× higher…") instead of the employee's stated purpose. | **Revamp:** show the real purpose, or hide the field. Risk text belongs only in the AI/evidence panel. |
| Q3 | P0 | Employee history | The "Sub category / merchant" column shows the AI summary ("Both receipts verified"). Under our fairness rule, employees must never see which check flagged them, and this column is where it would leak. | **Revamp:** show merchant and category only. Never show AI or HR text in employee views. |
| Q4 | P0 | HR history | James Okafor's RM1,150 claim is APPROVED but has no payout, and nothing says why. The likely cause is that his PayPal isn't linked. | **Add:** a payout column with a reason: "Paid", "Sending", "Waiting for PayPal link", or "Failed: retry". |
| Q5 | P0 | HR payouts | Three tabs say "(coming soon)". They read as unfinished work in a demo video. | **Eliminate** them until each one is built (audit queue, recoveries, agent log), then bring them back one at a time. |
| Q6 | P0 | HR review → AI Analysis | "Confidence 31%" is the old auto-approve gate that our new design removes. It contradicts the pitch. | **Revamp** (HR-2 evidence panel): show the tier chip, the risk score, hard stops and signal evidence. |
| Q7 | P0 | Login and landing | No PayPal anywhere. The brand is still "Reclaim", and the tagline promises "minutes, not days", while the pitch says "seconds". The landing page advertises "Autonomous approve and decline" and "REJECT" verdicts, which break our "no rejection on the AI's word alone" rule. | **Revamp:** rename to Reclaim Pay, put PayPal payouts in the hero, rewrite those two blocks, and add a "Built with" strip listing only tools that appear in the demo. |
| Q8 | P0 | HR on phone | The bottom navigation (Home, Policy, History, Settings) has no Payouts link. | **Add** Payouts to the mobile navigation. |
| Q9 | P0 | Demo recording | The Next.js dev "N" badge sits on top of the mobile Home tab and the sidebar logout. | **Eliminate** it for recording: record from a production build, or set `devIndicators: false`. |
| Q10 | P1 | Payouts ledger | "Route" says "Not recorded" on every row, because tiers aren't stored yet. The "Updated" column is cut off at 1440 px. | **Eliminate** Route until tiers exist. **Revamp** column widths so all columns fit at 1280 px. |
| Q11 | P1 | Everywhere | Money shows as "MYR 210.50" on some screens and "RM 210.50" on others. | **Revamp:** always use `MYR 0.00`, matching PayPal and the copy deck. |
| Q12 | P1 | Employee dashboard | It doesn't show whether payouts can reach the employee: no PayPal status and no instant-payout limit. The empty state is three zero cards and a table of bare headers. | **Add:** a PayPal status chip ("Paid to m***@… · Instant up to MYR 100", or "Connect PayPal to get paid"), the trust card (EM-5), and an empty state with one call to action, "Upload your first receipt". |
| Q13 | P1 | Employee settings | The PayPal card is the 4th section and sits below the fold. It is the most important setting in Reclaim Pay. | **Revamp:** put PayPal first, or give it its own page. Support the deep link `/employee/settings#paypal` for the dashboard chip. |
| Q14 | P1 | Login | There are two controls for the same choice: the "Employee Portal / HR Dashboard" toggle *and* the "Login as Employee / Login as HR" buttons. The left-hand paragraph is justified, which leaves uneven gaps between words. | **Eliminate** the toggle and keep the one-click demo buttons, which judges need. **Revamp** the paragraph to left-aligned, shorter copy. |
| Q15 | P1 | Sidebars and headers | The tagline appears twice on every page (under the sidebar logo and under the heading). | **Eliminate** the sidebar copy. |
| Q16 | P1 | HR review | Empty fields (Position, Location, Destination, Departure, Arrival) show labels with nothing under them. | **Eliminate** empty fields. Show a section only if it has at least one value. |
| Q17 | P1 | HR dashboard | The two "Review" links are styled differently (one underlined). "AI STATUS: Policy Flagged" will be wrong once tiers exist. | **Revamp:** this becomes the AG Grid triage queue with tier tabs (HR-1). |
| Q18 | P1 | Upload claim | A large empty preview panel. "Process Receipts" is disabled with no hint why. | **Revamp:** one full-width drop zone until a file is added, plus a hint ("Add at least one receipt"). |
| Q19 | P1 | Employee history | The category icon is a clock (the history icon) for every row. | **Revamp:** category icons (car, bed, fork and knife, laptop). |
| Q20 | P1 | HR history | The Policy and Resolved date columns are cut off at 1440 px ("3 Nov 2…"). | **Revamp:** short date `3 Nov`, and wrap the policy name to 2 lines. |
| Q21 | P1 | `/employee/submit` | Redirects to the dashboard and throws a `Performance.measure` error. It's a dead route. | **Eliminate** it. |
| Q22 | P2 | `/hr/review`, `/hr/view` | Opening them without an ID returns 404. | **Revamp:** redirect to the dashboard. |
| Q23 | P2 | Leftover sample-data screens | `hr/review`, `hr/view`, `hr/policy` and `employee/history` still import hard-coded sample data in places. | **Eliminate** after the demo. |
| Q24 | P2 | Landing | Sections appear only on scroll. That's fine for people, but the sections are blank in link previews and full-page screenshots. | **Revamp:** render content visible by default and animate only on top. |

**What passed**
- No horizontal page scroll on any page at 390 px.
- No 5xx responses.
- Every page loads in about 2.3 s on the local Docker stack.
- The login-reload bounce is fixed.
- The PayPal card, toasts, money flow and HR ledger all render.

---

## 2. UX for the hackathon features still to build

| Feature | Owner area | UX decisions |
|---|---|---|
| Triage queue (HR-1) | HR | Tabs: **Auto-paid · Quick approve · Review · Two-person**, with counts. Columns: claim ref, employee, amount, tier chip, risk bar (0–100), up to 3 signal chips with "+N", age. Batch approve only in the Quick tab. Its button reads "Approve 9 claims · MYR 402.00" and shows a confirmation sheet listing exclusions ("1 excluded: your own claim"). |
| Evidence panel (HR-2) | HR | Replaces Q6. Top line: "Why this needs you": the tier, the score and one sentence. One card per signal, with HR wording and its evidence (thumbnail diff, arithmetic table, matching earlier claim). Two-person progress reads "1 of 2 approvals · waiting for a second HR member", and the approve button is disabled for the first approver with the reason shown. |
| Autonomy Dial (HR-3) | HR | One page: a limits form on the left, a back-test chart on the right that updates live as you type (automation % against expected loss), and KPI tiles above. Saving shows "Before → after" and asks for a short reason. Kill switch: a red toggle with a typed confirmation, and a banner across every HR page while it is on. |
| Payouts tabs (HR-4) | HR | Bring back the tabs from Q5 one at a time. The agent log shows a green "Chain intact · 1,204 entries" badge. Recoveries show an invoice preview before "Send via PayPal". |
| Trust card and overpayment notice (EM-5/6) | Employee | Dashboard card: "Instant payouts up to MYR 100 · 2 more approved claims to reach MYR 200". The overpayment notice is calm, not accusing: amount, claim, dispute deadline, and a "Dispute" button that opens a one-field form. |
| Live timeline (EM-2) | Employee | Already built. When the backend events arrive, check that warnings show as neutral "Checked" rows for employees, never the signal names. |

---

## 3. UX notes for the future features

For the full list, see [FUTURE-DEVELOPMENT-PLAN.md](FUTURE-DEVELOPMENT-PLAN.md).

| Feature | UX direction |
|---|---|
| F1 Ask before you spend | A question box on the dashboard: "Can I claim…?". The answer card quotes the policy clause and the employee's own limit, with a "guidance, not approval" footnote. |
| F2 Company-paid bookings | "Request a booking" next to "Upload claim". A status stepper: Requested → Approved → Paid to vendor → Receipt matched. |
| F3 Payment matching | Evidence card with two columns: receipt and PayPal transaction, with differences highlighted. "Matching…" state for up to 3 h. |
| F4 Travel advance | A trip card with three steps: Plan → Advance paid → Settled. Shows "Spent MYR 410 of MYR 450 · MYR 40 will be deducted from your next claim". |
| F5 Contractors | Separate, smaller portal. The FX preview is shown before approval. Currency shown on every amount. |
| F6 Claim by chat | Messages short enough to fit on one phone screen. A link to the live timeline. One-time code to link the account. |
| F7 HR assistant | A side panel that only returns lists and drafts. The approve button stays the normal one. Every answer shows the filter it used. |
| F8 Policy simulator | Reuses the Autonomy Dial chart. A "draft policy" banner while editing. |
| F10 Wallet | One scrollable list grouped by status, a year-to-date total, and the next payout. |
| F11 Team budgets | A meter on the HR dashboard. Warnings at 75% and 90%. |
