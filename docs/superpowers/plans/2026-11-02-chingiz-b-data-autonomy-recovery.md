# Chingiz B — Data, Autonomy API and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared data model, the autonomy settings/status/back-test API, HR approval rules (dual approval, batch approve) and recovery with due process.

**Architecture:** Queries stay thin and the logic is pure functions with unit tests. Routers live in their own files (`api/autonomy.py`, `api/recoveries.py`). Every money-relevant action is written to a hash-chained `agent_actions` table.

**Tech Stack:** FastAPI, SQLModel, Alembic, Postgres (JSONB), pytest, PayPal Agent Toolkit (Python).

**Spec:** `docs/superpowers/specs/2026-11-02-reclaim-pay-hackathon-design.md`

**Runs in:** OpenCode Go, session #2. Task 1 is Day 0 and blocks everyone, so do it first.

## Global Constraints

- Defaults, tier names, signal codes and endpoint shapes come from the spec's "Contracts" section. Copy them verbatim.
- You are the only person who edits `core/models.py`, `core/enums.py`, `alembic/versions/*`, `pyproject.toml`/`uv.lock`, `main.py` and `api/schemas.py`. Others ask you.
- In `api/reimbursements.py`, don't touch lines 584–600 (the auto-payout block); Filbert owns them.
- Nothing from a client request may influence a tier or an approval rule.
- HR-only endpoints use `deps.get_current_hr_user`. Employees only ever see their own records.
- Money is `Decimal` in logic and `Numeric(12,2)` in the DB. Format as two decimals.
- Run tests from `backend/` with `uv run pytest -q`.

## Review Focus

- The same HR user approving a DUAL_REVIEW claim twice must not count as two approvals.
- HR must not approve their own claim, through PATCH or through batch approve.
- Two actions logged at the same moment must not fork the hash chain. Use the advisory lock in Task 1.
- An employee calling `/recoveries` must never see someone else's recovery.
- `execute` inside the dispute window, or on a DISPUTED recovery, must refuse (409) and send nothing to PayPal.

---

### Task 1 (Day 0): Dependencies, test harness, enums, models, migration, action log

**Files:**
- Modify: `backend/pyproject.toml`, `backend/uv.lock`
- Create: `backend/tests/__init__.py`, `backend/tests/conftest.py`
- Modify: `backend/core/enums.py`, `backend/core/models.py`
- Create: `backend/alembic/versions/<rev>_reclaim_pay.py`
- Create: `backend/engine/services/action_log.py`
- Create: `backend/engine/services/recovery_service.py` (stub only, filled in by Task 5)
- Test: `backend/tests/test_action_log.py`

**Interfaces:**
- Produces: `compute_hash(prev_hash: str, action_type: str, actor: str, reim_id: str | None, payload: dict, created_at: datetime) -> str`, `verify_rows(rows: list[dict]) -> bool`, `record_action(db: Session, action_type: AgentActionType, actor: str, reim_id: UUID | None, payload: dict) -> AgentAction`, `verify_chain(db: Session) -> bool`
- Produces (stub): `offset_for_reim(db: Session, reim: Reimbursement) -> tuple[Decimal, list[UUID]]`, which returns `(Decimal(str(reim.total_approved_amount or 0)), [])` until Task 5
- Produces: the models and columns listed in the spec under "Data model"

- [ ] **Step 1: Add dependencies and pytest config**

Run: `cd backend && uv add imagehash paypal-server-sdk paypal-agent-toolkit && uv add --dev respx pytest-asyncio`

If `paypal-agent-toolkit` won't resolve against `langchain==1.2.15`, drop it, record a ruling, and use the REST fallback in Task 5.

Add to `pyproject.toml`:
```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
asyncio_mode = "auto"
```
`tests/conftest.py` sets `os.environ.setdefault("SECRET_KEY", "test-secret-not-default")` and `os.environ.setdefault("PAYPAL_MOCK_MODE", "true")` before any import of `core.config`.

- [ ] **Step 2: Write the failing tests**

```python
from datetime import datetime, timezone
from engine.services.action_log import compute_hash, verify_rows

T = datetime(2026, 11, 3, 10, 0, tzinfo=timezone.utc)
ZERO = "0" * 64

def test_compute_hash_is_deterministic_and_key_order_free():
    a = compute_hash(ZERO, "DECISION", "agent", "r1", {"tier": "AUTO_PAY", "score": 5}, T)
    b = compute_hash(ZERO, "DECISION", "agent", "r1", {"score": 5, "tier": "AUTO_PAY"}, T)
    assert a == b and len(a) == 64

def _chain(n):
    rows, prev = [], ZERO
    for i in range(n):
        h = compute_hash(prev, "DECISION", "agent", f"r{i}", {"i": i}, T)
        rows.append({"prev_hash": prev, "hash": h, "action_type": "DECISION", "actor": "agent",
                     "reim_id": f"r{i}", "payload": {"i": i}, "created_at": T})
        prev = h
    return rows

def test_verify_rows_accepts_intact_chain():
    assert verify_rows(_chain(3)) is True

def test_verify_rows_detects_edited_payload():
    rows = _chain(3)
    rows[1]["payload"] = {"i": 99}
    assert verify_rows(rows) is False

def test_verify_rows_detects_deleted_row():
    rows = _chain(3)
    del rows[1]
    assert verify_rows(rows) is False
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `uv run pytest tests/test_action_log.py -q`
Expected: FAIL with `ModuleNotFoundError: engine.services.action_log`

- [ ] **Step 4: Implement `action_log.py`**

- `compute_hash`: sha256 hex of `json.dumps([prev_hash, action_type, actor, reim_id, payload, created_at.isoformat()], sort_keys=True, separators=(",", ":"), default=str)`.
- `verify_rows`: the first row's `prev_hash` is `"0"*64`, each later row's `prev_hash` equals the previous row's `hash`, and every `hash` recomputes correctly.
- `record_action`: run `SELECT pg_advisory_xact_lock(724242)`, read the last row by `action_id`, insert the new row with `prev_hash` and `hash`, and commit.
- `verify_chain`: load all rows ordered by `action_id` and call `verify_rows`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `uv run pytest tests/test_action_log.py -q`
Expected: 4 passed

- [ ] **Step 6: Add enums, models and the migration**

- Add the enums, columns and the three new tables exactly as the spec's "Data model" section lists them.
- `AutonomySettings.config` is JSONB. The store fills it from `AutonomyConfig().model_dump()` on first read, so the migration doesn't insert a row.
- Get `down_revision` from `uv run alembic heads`.

- [ ] **Step 7: Check that the migration applies and reverts**

Run: `docker compose up -d db && cd backend && uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head`
Expected: all three commands exit 0.

- [ ] **Step 8: Commit and open the contracts PR into `hackathon/reclaim-pay`**

```bash
git add backend/pyproject.toml backend/uv.lock backend/tests backend/core backend/alembic/versions backend/engine/services/action_log.py backend/engine/services/recovery_service.py
git commit -m "feat(contracts): reclaim pay data model, migration and hash-chained action log"
```

---

### Task 2 (Day 1): Autonomy store and settings, kill switch, status and actions API

**Files:**
- Create: `backend/engine/services/autonomy_store.py`
- Create: `backend/api/autonomy.py`
- Modify: `backend/main.py` (include the router at `/api/v1/autonomy`)
- Test: `backend/tests/test_autonomy_store.py`

**Interfaces:**
- Consumes: `AutonomyConfig`, `EmployeeHistory`, `PayeeStatus`, `AgentLedger`, `AutonomyDecision` from `engine/risk/types.py` (Filbert, Task 1)
- Produces: everything listed for `autonomy_store.py` in the spec's "Services others call", plus these pure helpers:
  - `history_from_rows(rows: list[dict], issue_dates: list[datetime], now: datetime) -> EmployeeHistory`. Each row has `status`, `tier`, `amount`, `updated_at`.
  - `ledger_from_rows(rows: list[dict], now: datetime, breaker_until: datetime | None) -> AgentLedger`
  - `payee_from_user(user: User) -> PayeeStatus`

- [ ] **Step 1: Write the failing tests**

```python
from datetime import datetime, timedelta, timezone
from engine.services.autonomy_store import history_from_rows, ledger_from_rows

NOW = datetime(2026, 11, 3, 15, 0, tzinfo=timezone.utc)

def row(status, tier, amount, hours_ago):
    return {"status": status, "tier": tier, "amount": amount, "updated_at": NOW - timedelta(hours=hours_ago)}

def test_history_counts_paid_and_auto_paid_today_and_month():
    rows = [row("PAID", "AUTO_PAY", 40, 2), row("PAID", "HR_REVIEW", 300, 3),
            row("PAID", "AUTO_PAY", 60, 24 * 2), row("REVIEW", "HR_QUICK", 80, 1)]
    h = history_from_rows(rows, issue_dates=[NOW - timedelta(days=100)], now=NOW)
    assert h.paid_claims == 3
    assert h.auto_paid_today == 40
    assert h.auto_paid_month == 100
    assert h.confirmed_issues_90d == 0 and h.confirmed_issues_180d == 1

def test_ledger_sums_today_and_last_hour_and_breaker():
    rows = [row("PAID", "AUTO_PAY", 50, 0.5), row("DISBURSING", "AUTO_PAY", 30, 5), row("PAID", "HR_REVIEW", 900, 0.2)]
    led = ledger_from_rows(rows, now=NOW, breaker_until=NOW + timedelta(minutes=30))
    assert led.auto_paid_today == 80 and led.auto_paid_last_hour == 50 and led.breaker_active is True
```

"Today" and "month" use UTC calendar boundaries. Only `APPROVED`, `DISBURSING` and `PAID` with tier `AUTO_PAY` count as auto-paid.

- [ ] **Step 2: Run the tests and confirm they fail.** Run `uv run pytest tests/test_autonomy_store.py -q`; expect an import error.

- [ ] **Step 3: Implement the store and the router.**

- Settings: `GET` returns `{config, enabled, version, breaker_until}`.
- `PUT` validates the body as `AutonomyConfig`, increments `version`, and logs `CONFIG_CHANGED` with the old and new values.
- `kill-switch` requires a non-empty `reason` and logs `KILL_SWITCH`.
- `status` counts today's decisions by tier from `reimbursements.tier`.
- `actions` returns the newest 50 rows plus `chain_valid` from `verify_chain`.
- `AUTO_REIMBURSE_ENABLED=false` in the environment also counts as disabled.

- [ ] **Step 4: Run the tests and confirm they pass.** Expect 2 passed.

- [ ] **Step 5: Smoke test against a running stack**

Run: `curl -s -H "Authorization: Bearer $HR_TOKEN" localhost:8000/api/v1/autonomy/settings`
Expected: `version` is 1 and `auto_limit_standard` is 100.0. After a `PUT`, `GET /autonomy/actions` shows `CONFIG_CHANGED` with `chain_valid: true`.

- [ ] **Step 6: Commit** (`feat(autonomy): settings, kill switch, status and action log API`)

---

### Task 3 (Day 1–2): Reimbursement API with tier fields, dual approval and batch approve

**Files:**
- Modify: `backend/api/reimbursements.py`. This covers `_build_reimbursement_response`, `list_reimbursements` and `update_reimbursement_status`, and adds `POST /batch-approve`. Don't touch lines 584–600.
- Create: `backend/engine/services/approvals.py`
- Test: `backend/tests/test_approvals.py`

**Interfaces:**
- Produces:
  - `register_approval(approvals: list[dict], approver_id: str, claimant_id: str, now: datetime, required: int) -> tuple[list[dict], bool]`. It raises `ValueError("SELF_APPROVAL")`.
  - `split_batch(rows: list[dict], approver_id: str) -> tuple[list[str], list[dict]]`. Each row has `reim_id`, `tier`, `status`, `user_id`. Skip reasons are `NOT_HR_QUICK`, `NOT_IN_REVIEW` and `SELF_APPROVAL`.

- [ ] **Step 1: Write the failing tests**

```python
import pytest
from datetime import datetime, timezone
from engine.services.approvals import register_approval, split_batch

NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)

def test_dual_needs_two_distinct_hr():
    a, done = register_approval([], "hr1", "emp1", NOW, required=2)
    assert done is False and len(a) == 1
    a, done = register_approval(a, "hr1", "emp1", NOW, required=2)
    assert done is False and len(a) == 1
    a, done = register_approval(a, "hr2", "emp1", NOW, required=2)
    assert done is True and {x["hr_id"] for x in a} == {"hr1", "hr2"}

def test_single_approval_completes_when_required_is_one():
    _, done = register_approval([], "hr1", "emp1", NOW, required=1)
    assert done is True

def test_self_approval_rejected():
    with pytest.raises(ValueError, match="SELF_APPROVAL"):
        register_approval([], "hr1", "hr1", NOW, required=1)

def test_batch_only_takes_hr_quick_in_review():
    rows = [{"reim_id": "a", "tier": "HR_QUICK", "status": "REVIEW", "user_id": "e1"},
            {"reim_id": "b", "tier": "HR_REVIEW", "status": "REVIEW", "user_id": "e2"},
            {"reim_id": "c", "tier": "HR_QUICK", "status": "PAID", "user_id": "e3"},
            {"reim_id": "d", "tier": "HR_QUICK", "status": "REVIEW", "user_id": "hr1"}]
    ok, skipped = split_batch(rows, approver_id="hr1")
    assert ok == ["a"]
    assert {s["reim_id"]: s["reason"] for s in skipped} == {"b": "NOT_HR_QUICK", "c": "NOT_IN_REVIEW", "d": "SELF_APPROVAL"}
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement the helpers and wire them in**

- In PATCH, `required = 2 if r.tier == "DUAL_REVIEW" else 1`.
- When status is APPROVED and the approval isn't complete: save `approvals`, keep `REVIEW`, and return the claim with `"awaiting_second_approval": true`.
- When it's complete, run the existing approval path. The existing `initiate_payout_sync` call at line 318 stays.
- Log `HR_APPROVAL` on every approval.
- `batch-approve` runs the same internal approve function for each eligible ID.
- The list response gains `tier`, `risk_score`, `autonomy`, `audit_selected` and `approvals`, plus the query filters `tier` and `audit_selected`.

- [ ] **Step 4: Run the tests and confirm they pass.** Expect 4 passed.

- [ ] **Step 5: Commit** (`feat(hr): dual approval, self-approval guard and batch approve`)

---

### Task 4 (Day 2): Back-test and the employee trust endpoint

**Files:**
- Create: `backend/engine/services/backtest_service.py`
- Modify: `backend/api/autonomy.py` (add `POST /backtest` and `GET /me`)
- Test: `backend/tests/test_backtest.py`

**Interfaces:**
- Consumes: `decide`, `trust_tier`, `limit_for` from `engine/risk/autonomy.py` (Filbert, Task 2)
- Produces:
  - `BacktestCase(claim: ClaimFacts, signals: list[RiskSignal], history: EmployeeHistory, payee: PayeeStatus, bad: bool)`
  - `run_backtest(cases: list[BacktestCase], config: AutonomyConfig, now: datetime) -> BacktestResult` (fields as in the spec)
  - `next_tier_info(history: EmployeeHistory) -> tuple[TrustTier | None, int]`
  - `load_backtest_cases(db, now, days=90) -> list[BacktestCase]`

- [ ] **Step 1: Write the failing tests**

```python
from datetime import datetime, timezone
import pytest
from engine.risk.types import (AutonomyConfig, ClaimFacts, EmployeeHistory, PayeeStatus,
                               RiskSignal, SignalCode, Severity, TrustTier)
from engine.services.backtest_service import BacktestCase, run_backtest, next_tier_info

NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)
HIST = EmployeeHistory(paid_claims=5, confirmed_issues_90d=0, confirmed_issues_180d=0, auto_paid_today=0, auto_paid_month=0)
PAYEE = PayeeStatus(verified=True, linked_at=datetime(2026, 10, 1, tzinfo=timezone.utc), changed_at=None)
DUP = RiskSignal(code=SignalCode.DUPLICATE_RECEIPT, severity=Severity.HIGH, points=50, message="dup")

def case(amount, bad, signals=()):
    claim = ClaimFacts(reim_id=None, user_id="u", amount=amount, currency="MYR", judgment="APPROVED",
                       confidence=0.95, over_category_budget=False, claimant_is_hr=False)
    return BacktestCase(claim=claim, signals=list(signals), history=HIST, payee=PAYEE, bad=bad)

CASES = [case(40, False), case(80, False), case(60, True), case(90, True, [DUP]), case(500, False)]

def test_backtest_numbers_with_default_config():
    r = run_backtest(CASES, AutonomyConfig(), NOW)
    assert r.total_claims == 5 and r.auto_paid_count == 3
    assert r.automation_rate == pytest.approx(0.6)
    assert r.auto_paid_amount == pytest.approx(180.0)
    assert r.bad_auto_paid_count == 1 and r.projected_leakage == pytest.approx(30.0)
    assert r.caught_bad_count == 1
    assert r.hr_hours_saved == pytest.approx(0.5)

def test_curve_is_monotonic_in_automation_rate():
    rates = [p.automation_rate for p in run_backtest(CASES, AutonomyConfig(), NOW).curve]
    assert rates == sorted(rates)

@pytest.mark.parametrize("paid,issues,expected", [(1, 0, (TrustTier.STANDARD, 2)), (5, 0, (TrustTier.TRUSTED, 5)),
                                                  (12, 0, (None, 0)), (12, 1, (TrustTier.STANDARD, 0))])
def test_next_tier_info(paid, issues, expected):
    h = EmployeeHistory(paid_claims=paid, confirmed_issues_90d=issues, confirmed_issues_180d=issues,
                        auto_paid_today=0, auto_paid_month=0)
    assert next_tier_info(h) == expected
```

The last case says an employee with an issue in the last 90 days is NEW, and the next tier is STANDARD once the 90 days pass. `claims_to_next_tier` is 0 in that case, and the reason text explains the wait.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement**

- The back-test ignores the company daily budget and the breaker. Use `AgentLedger(auto_paid_today=0, auto_paid_last_hour=0, breaker_active=False)` and say so in the response as `"assumptions": ["ignores daily budget and circuit breaker"]`.
- Curve points use limits 25, 50, 75, 100, 150, 200, 300 and 500, with `auto_limit_new = L/2` and `auto_limit_trusted = 2L`.
- `load_backtest_cases` marks a case bad if it was HR-rejected (`reviewed_by` set) or has a recovery that wasn't waived. Signals come from the stored `autonomy["signals"]`.

- [ ] **Step 4: Run the tests and confirm they pass.** Expect 6 passed.

- [ ] **Step 5: Commit** (`feat(autonomy): back-test and trust endpoint`)

---

### Task 5 (Day 2–3): Recovery with due process and a PayPal invoice via the Agent Toolkit

**Files:**
- Modify: `backend/engine/services/recovery_service.py`
- Create: `backend/engine/services/paypal_invoicing.py`
- Create: `backend/api/recoveries.py` (and include it in `main.py`)
- Test: `backend/tests/test_recovery.py`

**Interfaces:**
- Produces:
  - `choose_path(status: RecoveryStatus, dispute_until: datetime, now: datetime, unpaid_claim_amount: Decimal | None, amount: Decimal) -> Literal["WAIT", "OFFSET", "INVOICE", "BLOCKED"]`
  - `apply_offsets(amount: Decimal, offsets: list[Decimal]) -> Decimal`
  - `offset_for_reim` (the real version)
  - `mark_recovered(db, paypal_invoice_id: str) -> None`
  - `build_invoice_payload(recipient_email: str, amount: Decimal, currency: str, note: str, reference: str) -> dict`
  - `draft_recovery_note(summary: str, reason: str, amount: Decimal, currency: str, claim_ref: str) -> str`
  - `create_and_send_invoice(payload: dict) -> str` (returns the invoice ID)
- Consumes: `PayPalClient.request(method, path, json)` from Chingiz A, Task 1, for the REST fallback

- [ ] **Step 1: Write the failing tests**

```python
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from core.enums import RecoveryStatus
from engine.services.recovery_service import choose_path, apply_offsets
from engine.services.paypal_invoicing import build_invoice_payload

NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)
AMT = Decimal("30.00")

def test_wait_inside_dispute_window():
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW + timedelta(hours=1), NOW, None, AMT) == "WAIT"

def test_disputed_is_blocked():
    assert choose_path(RecoveryStatus.DISPUTED, NOW - timedelta(hours=1), NOW, Decimal("100"), AMT) == "BLOCKED"

def test_offset_when_unpaid_claim_covers_amount():
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW - timedelta(hours=1), NOW, Decimal("48.00"), AMT) == "OFFSET"

def test_invoice_when_no_claim_or_not_enough():
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW - timedelta(hours=1), NOW, None, AMT) == "INVOICE"
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW - timedelta(hours=1), NOW, Decimal("10"), AMT) == "INVOICE"

def test_offsets_never_go_negative():
    assert apply_offsets(Decimal("48.00"), [Decimal("30.00")]) == Decimal("18.00")
    assert apply_offsets(Decimal("20.00"), [Decimal("30.00")]) == Decimal("0.00")

def test_invoice_payload_shape():
    p = build_invoice_payload("a@example.com", AMT, "MYR", "note", "RC-1a2b3c4d")
    assert p["detail"]["currency_code"] == "MYR" and p["detail"]["reference"] == "RC-1a2b3c4d"
    assert p["primary_recipients"][0]["billing_info"]["email_address"] == "a@example.com"
    assert p["items"][0]["unit_amount"] == {"currency_code": "MYR", "value": "30.00"}
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement**

- **Agent Toolkit first.** Read the `paypal-agent-toolkit` README for the exact imports. Expected: `from paypal_agent_toolkit.langchain.toolkit import PayPalToolkit` and `from paypal_agent_toolkit.shared.configuration import Configuration, Context`, with invoice actions enabled and `Context(sandbox=True)`. Map `build_invoice_payload` onto the create-invoice tool's arguments, then call the send tool.
- **REST fallback.** If the toolkit can't take this payload within 30 minutes, record a ruling and use `POST /v2/invoicing/invoices` then `POST /v2/invoicing/invoices/{id}/send` through `PayPalClient.request`.
- `draft_recovery_note` uses `get_chat_llm()`. On any error it falls back to: `"We paid {currency} {amount} more than the approved amount for claim {claim_ref}: {reason}. Please settle this invoice, or reply to dispute it."`
- `create` notifies the employee with a link to `/employee/dashboard?recovery={id}` and logs `RECOVERY_CREATED`.
- `execute` logs `RECOVERY_INVOICED` or marks the recovery OFFSET, setting `offset_reim_id` to the employee's oldest claim that is APPROVED or REVIEW and unpaid.
- **Order of operations is the agent-safety boundary.** HR first sees the LLM-drafted note through `invoice-preview`, and only then can call `execute`.

- [ ] **Step 4: Run the tests and confirm they pass.** Expect 6 passed.

- [ ] **Step 5: Sandbox check.** For seed scenario S8, calling `execute` creates an invoice that shows up in the sandbox business account's invoice list.

- [ ] **Step 6: Commit** (`feat(recovery): due-process recovery with offset and PayPal invoice`)
