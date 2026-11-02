# Chingiz A — PayPal Money Movement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mocked Xendit payouts with PayPal Payouts (sandbox) to employees' verified PayPal accounts, with idempotent requests, signed webhooks, "Log in with PayPal" payee verification and a payout ledger.

**Architecture:** `PayPalClient` is a small async httpx client with pure helpers around it, tested with `respx`. `payout_service` keeps its two entry points, so existing callers don't change. A `MockPayPalClient` (`PAYPAL_MOCK_MODE=true`) lets the frontend work without sandbox keys.

**Tech Stack:** FastAPI, httpx, respx, python-jose (state tokens), PayPal REST: Payouts v1, Identity, Webhooks verify; PayPal Server SDK (stretch).

**Spec:** `docs/superpowers/specs/2026-11-02-reclaim-pay-hackathon-design.md` (D4, D5, Contracts → HTTP API)

**Runs in:** OpenCode Go, session #1. Install APIMatic's Context Plugin first (`npx context-plugins install paypal`), so the agent uses current PayPal SDK docs.

## Global Constraints

- `sender_batch_id = f"RC-{reim_id.hex}-{attempt}"`. Retry a 5xx or a timeout once with the **same** ID. Never generate a random idempotency key.
- Payouts go only to `recipient_type="PAYPAL_ID"` with the employee's verified `paypal_payer_id`. No typed emails, no bank details.
- Webhooks are rejected unless `verify-webhook-signature` returns `SUCCESS`. The only exception is `PAYPAL_MOCK_MODE=true`.
- Never log secrets, access tokens or full emails. Mask emails as `a***@gmail.com`.
- Amounts are `Decimal` and sent as strings with two decimals. The currency comes from `AutonomyConfig.currency`; the default is `MYR`, and the spike in Task 0 decides.
- You own `core/config.py` and `.env.example`. Teammates send you their settings.

## Review Focus

- **The same webhook delivered twice.** There must be no second "paid" notification and no status regression.
- **A webhook that arrives before the create call has committed** (unknown item ID). Fall back to `sender_item_id`, which is the `reim_id`, and never create orphan rows.
- **The employee relinks to a different PayPal account mid-claim.** The pending payout keeps the payer it was created with, and the change starts the 72 h cool-down.
- **A sandbox outage during the demo.** `GET /payouts/{reim_id}` must keep showing the last known status, not a 500 error.
- **An expired or forged `state` on the PayPal callback.** Redirect with `?paypal=error`, and change nothing.
- **Unlinking, then linking someone else's PayPal account.** This must start the 72 h cool-down like any other change; Task 4 pins it with a test.

---

### Task 0 (Day 0, spike, about 1 h, no TDD): Sandbox setup

- [ ] **Step 1: Create the sandbox app and accounts.** In developer.paypal.com:
  - Create a REST app, a sandbox Business account (sender) and two Personal accounts (receivers).
  - Choose Malaysia as the country so MYR works; fall back to USD.
  - Fund the business account.

- [ ] **Step 2: Enable "Log in with PayPal" on the app.**
  - Return URL: `{BACKEND_PUBLIC_URL}/api/v1/paypal/callback`.
  - Attributes: email, PayPal account ID (payer ID), account verification status.
  - Use a tunnel (`cloudflared tunnel --url http://localhost:8000`) until Darrell's staging URL exists.

- [ ] **Step 3: Create a webhook** at `{BACKEND_PUBLIC_URL}/api/v1/paypal/webhook` for the `PAYMENT.PAYOUTS-ITEM.*`, `PAYMENT.PAYOUTSBATCH.*` and `INVOICING.INVOICE.PAID` events. Note the webhook ID.

- [ ] **Step 4: Prove a payout works with curl** before writing code: get a token, then `POST /v1/payments/payouts` for 1.00 in MYR to one personal account. If MYR is refused, switch to USD and tell the team.

- [ ] **Step 5: Write the config**

- Write `docs/hackathon/paypal-sandbox.md` (account roles, how to log in to the sandbox site to show the money arriving; no secrets).
- Add to `.env.example` and `core/config.py`: `PAYPAL_MOCK_MODE=true`, `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`, `PAYPAL_WEB_URL=https://www.sandbox.paypal.com`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_CURRENCY=MYR`, `BACKEND_PUBLIC_URL=http://localhost:8000`, `FRONTEND_PUBLIC_URL=http://localhost:3000`.
- **Also add every new variable to the backend `environment:` list in both `compose.yml` and `docker-compose.production.yml`.** Both files pass variables one by one, so anything missing there never reaches the container.
- Commit.

---

### Task 1 (Day 1): `PayPalClient` and pure helpers

**Files:**
- Create: `backend/engine/services/paypal_client.py`
- Test: `backend/tests/test_paypal_client.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class PayoutCreated: batch_id: str; batch_status: str
@dataclass(frozen=True)
class PayoutItem: item_id: str; transaction_status: str; sender_item_id: str; error: str | None
@dataclass(frozen=True)
class PayoutBatch: batch_id: str; batch_status: str; items: list[PayoutItem]
@dataclass(frozen=True)
class PayPalUser: payer_id: str; email: str | None; verified: bool
class PayPalError(Exception): status: int; name: str | None; debug_id: str | None

class PayPalClient:
    def __init__(self, base_url: str, client_id: str, client_secret: str,
                 transport: httpx.AsyncBaseTransport | None = None): ...
    async def access_token(self) -> str: ...
    async def request(self, method: str, path: str, json: dict | None = None,
                      headers: dict | None = None) -> dict: ...
    async def create_payout(self, *, sender_batch_id: str, payer_id: str, amount: Decimal,
                            currency: str, note: str, sender_item_id: str) -> PayoutCreated: ...
    async def get_payout_batch(self, batch_id: str) -> PayoutBatch: ...
    async def cancel_payout_item(self, item_id: str) -> str: ...
    async def verify_webhook(self, headers: Mapping[str, str], event: dict, webhook_id: str) -> bool: ...
    async def exchange_auth_code(self, code: str) -> str: ...
    async def get_userinfo(self, user_access_token: str) -> PayPalUser: ...

def sender_batch_id_for(reim_id: UUID, attempt: int) -> str: ...
def map_item_status(transaction_status: str) -> PayoutStatus: ...
def format_amount(amount: Decimal) -> str: ...
def get_paypal_client() -> "PayPalClient | MockPayPalClient": ...
```

- [ ] **Step 1: Write the failing tests** (with respx)

```python
import json
from decimal import Decimal
from uuid import UUID
import httpx, pytest, respx
from core.enums import PayoutStatus
from engine.services.paypal_client import PayPalClient, PayPalError, sender_batch_id_for, map_item_status

BASE = "https://api-m.sandbox.paypal.com"
RID = UUID("12345678-1234-5678-1234-567812345678")

def client():
    return PayPalClient(BASE, "cid", "secret")

def token_route(mock):
    return mock.post(f"{BASE}/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T", "expires_in": 3600}))

def test_sender_batch_id_format():
    assert sender_batch_id_for(RID, 2) == "RC-12345678123456781234567812345678-2"

@pytest.mark.parametrize("raw,expected", [("SUCCESS", "SUCCEEDED"), ("FAILED", "FAILED"), ("DENIED", "FAILED"),
    ("BLOCKED", "FAILED"), ("UNCLAIMED", "REQUESTED"), ("PENDING", "REQUESTED"), ("ONHOLD", "REQUESTED"),
    ("RETURNED", "REVERSED"), ("REFUNDED", "REVERSED"), ("REVERSED", "REVERSED"), ("CANCELED", "CANCELLED"),
    ("SOMETHING_NEW", "REQUESTED")])
def test_map_item_status(raw, expected):
    assert map_item_status(raw) == PayoutStatus(expected)

@respx.mock
async def test_token_is_cached():
    route = token_route(respx)
    c = client(); await c.access_token(); await c.access_token()
    assert route.call_count == 1

@respx.mock
async def test_create_payout_payload_and_result():
    token_route(respx)
    payout = respx.post(f"{BASE}/v1/payments/payouts").mock(return_value=httpx.Response(
        201, json={"batch_header": {"payout_batch_id": "B1", "batch_status": "PENDING"}}))
    res = await client().create_payout(sender_batch_id=sender_batch_id_for(RID, 1), payer_id="PAYERID123",
                                       amount=Decimal("48"), currency="MYR", note="RC-12345678", sender_item_id=str(RID))
    body = json.loads(payout.calls[0].request.content)
    assert body["sender_batch_header"]["sender_batch_id"] == "RC-12345678123456781234567812345678-1"
    assert body["items"][0] == {"recipient_type": "PAYPAL_ID", "receiver": "PAYERID123",
                                "amount": {"value": "48.00", "currency": "MYR"}, "note": "RC-12345678",
                                "sender_item_id": str(RID)}
    assert (res.batch_id, res.batch_status) == ("B1", "PENDING")

@respx.mock
async def test_5xx_retried_once_with_same_batch_id():
    token_route(respx)
    route = respx.post(f"{BASE}/v1/payments/payouts").mock(side_effect=[
        httpx.Response(503), httpx.Response(201, json={"batch_header": {"payout_batch_id": "B1", "batch_status": "PENDING"}})])
    await client().create_payout(sender_batch_id="RC-x-1", payer_id="P", amount=Decimal("1"), currency="MYR",
                                 note="n", sender_item_id="s")
    ids = [json.loads(c.request.content)["sender_batch_header"]["sender_batch_id"] for c in route.calls]
    assert ids == ["RC-x-1", "RC-x-1"]

@respx.mock
async def test_4xx_raises_paypal_error():
    token_route(respx)
    respx.post(f"{BASE}/v1/payments/payouts").mock(return_value=httpx.Response(
        400, json={"name": "VALIDATION_ERROR", "debug_id": "dbg1"}))
    with pytest.raises(PayPalError) as e:
        await client().create_payout(sender_batch_id="RC-x-1", payer_id="P", amount=Decimal("1"),
                                     currency="MYR", note="n", sender_item_id="s")
    assert (e.value.status, e.value.name, e.value.debug_id) == (400, "VALIDATION_ERROR", "dbg1")

@respx.mock
async def test_verify_webhook_success_and_failure():
    token_route(respx)
    route = respx.post(f"{BASE}/v1/notifications/verify-webhook-signature").mock(side_effect=[
        httpx.Response(200, json={"verification_status": "SUCCESS"}),
        httpx.Response(200, json={"verification_status": "FAILURE"})])
    headers = {"paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://c", "paypal-transmission-id": "t1",
               "paypal-transmission-sig": "sig", "paypal-transmission-time": "2026-11-03T10:00:00Z"}
    assert await client().verify_webhook(headers, {"id": "WH-1"}, "WEBHOOK_ID") is True
    assert await client().verify_webhook(headers, {"id": "WH-1"}, "WEBHOOK_ID") is False
    sent = json.loads(route.calls[0].request.content)
    assert sent["transmission_id"] == "t1" and sent["webhook_id"] == "WEBHOOK_ID" and sent["webhook_event"] == {"id": "WH-1"}

@respx.mock
async def test_userinfo_parses_payer_and_verified_string():
    respx.get(url__startswith=f"{BASE}/v1/identity/oauth2/userinfo").mock(return_value=httpx.Response(200, json={
        "payer_id": "P1", "emails": [{"value": "a@b.com", "primary": True}], "verified_account": "true"}))
    u = await client().get_userinfo("USER_TOKEN")
    assert (u.payer_id, u.email, u.verified) == ("P1", "a@b.com", True)
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run `cd backend && uv run pytest tests/test_paypal_client.py -q`; expect an import error.

- [ ] **Step 3: Implement**

- The token is cached until `expires_in − 60` seconds.
- `request` raises `PayPalError` for 4xx, and retries a 5xx or timeout once.
- Userinfo: `GET /v1/identity/oauth2/userinfo?schema=paypalv1.1`, falling back to `/v1/identity/openidconnect/userinfo?schema=openid` on 404. `verified_account` may arrive as a bool or a string.
- `MockPayPalClient` has the same methods. `create_payout` returns `PENDING`, and `get_payout_batch` returns `SUCCESS` 8 seconds after creation.
- `get_paypal_client()` picks the client from `PAYPAL_MOCK_MODE`.

- [ ] **Step 4: Run the tests and confirm they pass.** Expect all passed.

- [ ] **Step 5: Commit** (`feat(paypal): payouts client with idempotent batches and webhook verification`)

---

### Task 2 (Day 1–2): `payout_service` on PayPal

**Files:**
- Modify: `backend/engine/services/payout_service.py`. Keep `initiate_payout_sync` and `initiate_payout_async` with the same signatures, and remove the Xendit imports.
- Test: `backend/tests/test_payout_plan.py`

**Interfaces:**
- Consumes: `recovery_service.offset_for_reim` (stub from Chingiz B Task 1) and `action_log.record_action`
- Produces: `payout_plan(reim_status: str, net_amount: Decimal, existing_statuses: list[str], payee_verified: bool) -> tuple[str, Decimal | None, int]`, whose first element is one of `SKIP_NOT_APPROVED`, `SKIP_EXISTING`, `SKIP_NO_PAYEE`, `SKIP_ZERO`, `CREATE`. `net_amount` is the first value returned by `offset_for_reim`.

- [ ] **Step 1: Write the failing tests**

```python
from decimal import Decimal
from engine.services.payout_service import payout_plan

def test_creates_first_attempt():
    assert payout_plan("APPROVED", Decimal("48.00"), [], True) == ("CREATE", Decimal("48.00"), 1)

def test_existing_live_payout_blocks_new_one():
    assert payout_plan("APPROVED", Decimal("48.00"), ["REQUESTED"], True)[0] == "SKIP_EXISTING"
    assert payout_plan("APPROVED", Decimal("48.00"), ["SUCCEEDED"], True)[0] == "SKIP_EXISTING"

def test_retry_after_failure_uses_next_attempt():
    assert payout_plan("APPROVED", Decimal("48.00"), ["FAILED", "REVERSED"], True) == ("CREATE", Decimal("48.00"), 3)

def test_skips():
    assert payout_plan("REVIEW", Decimal("48"), [], True)[0] == "SKIP_NOT_APPROVED"
    assert payout_plan("APPROVED", Decimal("48"), [], False)[0] == "SKIP_NO_PAYEE"
    assert payout_plan("APPROVED", Decimal("0.00"), [], True)[0] == "SKIP_ZERO"
```

Offset arithmetic is tested in Chingiz B Task 5 (`apply_offsets`).

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement `payout_plan` and rewrite both entry points around it**

- Payout row: `provider="PAYPAL"`, `channel_code="PAYPAL"`, `provider_batch_id`, `attempt`, `idempotency_key = sender_batch_id`, `reference_id = f"RC-{str(reim_id)[:8]}"`, status `ACCEPTED`.
- Log `PAYOUT_CREATED` with `{amount, currency, sender_batch_id, batch_id}`.
- Notification: `"Sending {currency} {amount:,.2f} to your PayPal account ({masked})"`.
- In mock mode, schedule a status refresh after 8 seconds using the existing loop pattern.
- On `SKIP_ZERO` (fully offset), set the claim to PAID with the note "Settled against an earlier overpayment".

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Commit** (`feat(payouts): PayPal payouts in payout_service`)

---

### Task 3 (Day 2): Webhook and status refresh

**Files:**
- Create: `backend/api/paypal.py` (router at `/api/v1/paypal`; Chingiz B registers it in `main.py`, or do it in this PR)
- Modify: `backend/api/payouts.py`. `GET /{reim_id}` refreshes; delete the Xendit webhook route and channel listing.
- Test: `backend/tests/test_payout_status.py`

**Interfaces:**
- Produces:
  - `next_status(current: PayoutStatus, incoming: PayoutStatus) -> PayoutStatus`
  - `reim_status_for(payout_status: PayoutStatus) -> ReimbursementStatus | None`
  - `apply_item_update(db, item_id: str | None, sender_item_id: str | None, transaction_status: str) -> Payout | None`
- Consumes: `recovery_service.mark_recovered` (Chingiz B Task 5)

- [ ] **Step 1: Write the failing tests**

```python
from core.enums import PayoutStatus as P, ReimbursementStatus as R
from api.paypal import next_status, reim_status_for

def test_final_states_do_not_regress():
    assert next_status(P.SUCCEEDED, P.REQUESTED) == P.SUCCEEDED
    assert next_status(P.FAILED, P.SUCCEEDED) == P.FAILED
    assert next_status(P.REQUESTED, P.SUCCEEDED) == P.SUCCEEDED

def test_success_can_become_reversed():
    assert next_status(P.SUCCEEDED, P.REVERSED) == P.REVERSED

def test_reim_status_mapping():
    assert reim_status_for(P.SUCCEEDED) == R.PAID
    assert reim_status_for(P.FAILED) == R.DISBURSEMENT_FAILED
    assert reim_status_for(P.REVERSED) == R.DISBURSEMENT_FAILED
    assert reim_status_for(P.REQUESTED) is None
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement the webhook route**

- Verify the signature (skipped in mock mode), then dispatch:
  - `PAYMENT.PAYOUTS-ITEM.*`: read `resource.payout_item_id`, `resource.transaction_status` and `resource.payout_item.sender_item_id`, then call `apply_item_update`.
  - `INVOICING.INVOICE.PAID`: call `mark_recovered(resource.id)`.
  - Anything else: return 200 and ignore it.
- Notify only when the status actually changed. On PAID, tell the employee "{currency} {amount} arrived in your PayPal account". On failure, notify HR.
- Log `PAYOUT_STATUS`.
- `GET /payouts/{reim_id}`: if the status isn't final and `updated_at` is more than 10 seconds old, call `get_payout_batch` and apply. On a `PayPalError`, return the stored row.

- [ ] **Step 4: Run the tests and confirm they pass.** Then check in mock mode: approve S1, and `GET /payouts/{reim_id}` shows SUCCEEDED within 10 seconds.

- [ ] **Step 5: Commit** (`feat(paypal): signed webhooks and payout status refresh`)

---

### Task 4 (Day 2): "Log in with PayPal" payee verification

**Files:**
- Modify: `backend/api/paypal.py` (`connect-url`, `callback`, `status`, `DELETE link`)
- Test: `backend/tests/test_paypal_identity.py`

**Interfaces:**
- Produces:
  - `make_state(user_id: UUID, secret: str, now: datetime) -> str`
  - `read_state(token: str, secret: str, now: datetime) -> UUID` (raises `ValueError`)
  - `link_update(current_payer_id: str | None, ever_linked: bool, user: PayPalUser, now: datetime) -> dict`. `ever_linked` is `user.paypal_linked_at is not None`; unlinking keeps `paypal_linked_at`, so "unlink, then link a different account" still counts as a change.
  - `cooldown_until(changed_at: datetime | None, hours: int) -> datetime | None`
  - `mask_email(email: str) -> str`

- [ ] **Step 1: Write the failing tests**

```python
from datetime import datetime, timedelta, timezone
from uuid import UUID
import pytest
from engine.services.paypal_client import PayPalUser
from api.paypal import make_state, read_state, link_update, cooldown_until, mask_email

NOW = datetime(2026, 11, 3, 10, tzinfo=timezone.utc)
U = UUID("12345678-1234-5678-1234-567812345678")

def test_state_roundtrip_and_expiry():
    tok = make_state(U, "s", NOW)
    assert read_state(tok, "s", NOW + timedelta(minutes=9)) == U
    with pytest.raises(ValueError):
        read_state(tok, "s", NOW + timedelta(minutes=11))
    with pytest.raises(ValueError):
        read_state(tok, "other-secret", NOW)

def test_first_link_has_no_cooldown():
    upd = link_update(None, False, PayPalUser("P1", "a@b.com", True), NOW)
    assert upd["paypal_payer_id"] == "P1" and upd["paypal_verified"] is True
    assert upd["payout_destination_changed_at"] is None

def test_changed_account_starts_cooldown():
    upd = link_update("P0", True, PayPalUser("P1", "a@b.com", True), NOW)
    assert upd["payout_destination_changed_at"] == NOW
    assert cooldown_until(NOW, 72) == NOW + timedelta(hours=72)

def test_unlink_then_link_other_account_still_cools_down():
    assert link_update(None, True, PayPalUser("P9", "x@y.com", True), NOW)["payout_destination_changed_at"] == NOW

def test_same_account_relink_keeps_no_cooldown():
    assert "payout_destination_changed_at" not in link_update("P1", True, PayPalUser("P1", "a@b.com", True), NOW)

def test_mask_email():
    assert mask_email("aisyah.rahman@gmail.com") == "a***@gmail.com"
```

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement**

- `state` is an HS256 JWT signed with `SECRET_KEY`, with claims `sub` (user ID), `purpose="paypal_link"` and a 10-minute expiry.
- `connect-url` returns `{PAYPAL_WEB_URL}/connect?flowEntry=static&client_id=…&response_type=code&scope=openid%20email%20https%3A%2F%2Furi.paypal.com%2Fservices%2Fpaypalattributes&redirect_uri=…&state=…`. Check the format against the "Log in with PayPal" integrate guide.
- `callback` does: `read_state` → `exchange_auth_code` → `get_userinfo` → `link_update` → save → log `PAYEE_LINKED` (masked email, `changed` flag).
- When the account changed, notify the employee in-app and by push: "Your payout account changed. Instant payouts are paused until {time}. If this wasn't you, contact HR."
- Redirect to `{FRONTEND_PUBLIC_URL}/employee/settings?paypal=linked`. Any error redirects with `?paypal=error`.

- [ ] **Step 4: Run the tests, then try it in the sandbox:** link a sandbox personal account and check that `GET /paypal/status` returns `linked: true, verified: true`.

- [ ] **Step 5: Commit** (`feat(paypal): verified payees with Log in with PayPal`)

---

### Task 5 (Day 2): Payout ledger endpoint

**Files:**
- Modify: `backend/api/payouts.py` (`GET /` with `status`, `from` and `to` filters)

- [ ] **Step 1: Implement**

- Rows contain `payout_id, reim_id, claim_ref, employee_name, amount, currency, status, tier, provider_batch_id, provider_item_id, attempt, audit_selected, created_at, updated_at`, newest first, limit 500.
- HR only.

- [ ] **Step 2: Verify** with Darrell's Postman "Payouts → ledger" request: 200, and every row has a `status` and a `tier`.

- [ ] **Step 3: Commit** (`feat(payouts): ledger endpoint`)

---

### Task 6 (Day 3, stretch): Reconciliation with the PayPal Server SDK (Transaction Search)

**Files:**
- Create: `backend/engine/services/reconcile_service.py`; add `GET /payouts/reconcile?days=1` in `api/payouts.py`
- Test: `backend/tests/test_reconcile.py`

**Interfaces:**
- Produces:
  - `match_transactions(payouts: list[tuple[str, Decimal, datetime]], txns: list[tuple[str, Decimal, datetime]], window_minutes: int = 120) -> ReconcileReport`, where the report has `matched: list[tuple[str, str]]`, `missing_in_paypal: list[str]` and `unknown_in_paypal: list[str]`

- [ ] **Step 1: Write the failing test.** Two payouts and three transactions: one exact match, one payout with no transaction, and two transactions with no payout. Assert the three lists exactly. Matching is greedy one-to-one on equal amount within the time window.

- [ ] **Step 2: Implement.** Fetch with the PayPal Server SDK's Transaction Search controller; ask the Context Plugin for the exact call. Sandbox data can lag by hours, so the HR ledger shows "Reconciled N of M" only when there's data.

- [ ] **Step 3: Run the tests, then commit** (`feat(paypal): ledger reconciliation via Server SDK`)
