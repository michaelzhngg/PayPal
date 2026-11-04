from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import select

from api import deps
from core.config import settings
from core.enums import UserRole
from core.models import AgentAction, Notification, Recovery, Reimbursement, User
from engine.services import paypal_invoicing, payout_service
from engine.services.action_log import verify_chain
from engine.services.payout_service import payout_plan
from engine.services.recovery_service import fallback_note, mark_recovered, offset_for_reim

REASON = "Breakfast was included in the hotel rate and also claimed separately"


def _user(db, role, name, paypal_email=None):
    u = User(email=f"{name}-{uuid4().hex[:8]}@test.local", hashed_password="x", name=name, role=role,
             paypal_email=paypal_email)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _claim(db, owner, status="PAID", amount=195.0, days_ago=10):
    at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    r = Reimbursement(user_id=owner.user_id, main_category="Accommodations", currency="MYR",
                      total_claimed_amount=amount, total_approved_amount=amount, judgment="APPROVED",
                      summary="Hotel Seri Kenanga, one night", status=status, created_at=at, updated_at=at)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@pytest.fixture
def env(pg_db, monkeypatch):
    from main import app

    db = pg_db
    db.exec(text("DELETE FROM agent_actions"))
    # Push delivery opens its own session on DATABASE_URL; keep tests on the scratch DB only.
    monkeypatch.setattr(payout_service, "fire_and_forget_push", lambda *a, **k: None)
    monkeypatch.setattr(settings, "PAYPAL_MOCK_MODE", True)
    import engine.llm
    monkeypatch.setattr(engine.llm, "get_chat_llm", lambda: (_ for _ in ()).throw(RuntimeError("no LLM in tests")))

    users = {
        "hr": _user(db, UserRole.HR, "hr"),
        "emp": _user(db, UserRole.Employee, "Hafiz Rahman", paypal_email="hafiz.paypal@example.com"),
        "other": _user(db, UserRole.Employee, "other"),
    }
    acting = {"user": users["hr"]}
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_current_user] = lambda: acting["user"]

    def act_as(name):
        acting["user"] = users[name]

    try:
        yield TestClient(app), db, users, act_as
    finally:
        app.dependency_overrides.clear()


def _open(client, reim, amount=30.0):
    resp = client.post("/api/v1/recoveries", json={"reim_id": str(reim.reim_id), "amount": amount, "reason": REASON})
    assert resp.status_code == 201, resp.text
    return resp.json()


def _close_window(db, recovery_id):
    rec = db.get(Recovery, recovery_id)
    rec.dispute_until = datetime.now(timezone.utc) - timedelta(days=1)
    db.add(rec)
    db.commit()


def _actions(db, action_type):
    return db.exec(select(AgentAction).where(AgentAction.action_type == action_type)
                   .order_by(AgentAction.action_id)).all()


def _notes(db, user):
    return db.exec(select(Notification).where(Notification.user_id == user.user_id)
                   .order_by(Notification.created_at)).all()


def _no_paypal(monkeypatch):
    async def boom(payload):
        pytest.fail("PayPal must not be called")
    monkeypatch.setattr(paypal_invoicing, "create_and_send_invoice", boom)


def test_create_sends_notice_and_logs(env):
    client, db, users, _ = env
    reim = _claim(db, users["emp"])
    before = datetime.now(timezone.utc)
    body = _open(client, reim)

    assert body["status"] == "NOTICE_SENT" and body["amount"] == 30.0 and body["currency"] == "MYR"
    assert body["user_id"] == str(users["emp"].user_id) and body["paypal_invoice_id"] is None
    until = datetime.fromisoformat(body["dispute_until"].replace("Z", "+00:00"))
    assert timedelta(hours=119, minutes=59) < until - before < timedelta(hours=120, minutes=1)

    (logged,) = _actions(db, "RECOVERY_CREATED")
    assert logged.payload == {"recovery_id": body["recovery_id"], "amount": "30.00"}
    (note,) = _notes(db, users["emp"])
    assert note.title == "Overpayment notice"
    assert note.message.startswith(f"We paid MYR 30.00 more than approved on claim RC-{str(reim.reim_id)[:8]}. "
                                   "You can dispute until ")
    assert note.link == f"/employee/dashboard?recovery={body['recovery_id']}"


def test_create_validates_amount_and_claim(env):
    client, db, users, _ = env
    reim = _claim(db, users["emp"], amount=50.0)
    post = lambda amount, r=reim: client.post(
        "/api/v1/recoveries", json={"reim_id": str(r.reim_id), "amount": amount, "reason": REASON})

    assert post(0).status_code == 422
    assert post(-5).status_code == 422
    assert post(50.01).json()["detail"] == "AMOUNT_EXCEEDS_APPROVED"
    _open(client, reim, 40.0)
    # Open recoveries on the same claim count against its approved amount.
    assert post(10.01).status_code == 422
    assert post(10.0).status_code == 201
    assert post(5, _claim(db, users["emp"], status="REVIEW")).json()["detail"] == "NOT_PAID"
    assert post(5, _claim(db, users["hr"])).status_code == 403


def test_execute_refuses_inside_the_window(env, monkeypatch):
    client, db, users, _ = env
    rec = _open(client, _claim(db, users["emp"]))
    _no_paypal(monkeypatch)

    resp = client.post(f"/api/v1/recoveries/{rec['recovery_id']}/execute")
    assert resp.status_code == 409 and resp.json() == {"detail": "DISPUTE_WINDOW_OPEN"}
    assert db.get(Recovery, rec["recovery_id"]).status == "NOTICE_SENT"


def test_dispute_blocks_execute_and_can_only_be_waived(env, monkeypatch):
    client, db, users, act_as = env
    reim = _claim(db, users["emp"])
    rec = _open(client, reim)
    rid = rec["recovery_id"]

    act_as("emp")
    resp = client.post(f"/api/v1/recoveries/{rid}/dispute", json={"note": "Breakfast wasn't included"})
    assert resp.status_code == 200 and resp.json()["status"] == "DISPUTED"
    assert resp.json()["dispute_note"] == "Breakfast wasn't included"
    assert client.post(f"/api/v1/recoveries/{rid}/dispute", json={"note": "again"}).status_code == 409

    (hr_note,) = _notes(db, users["hr"])
    assert hr_note.title == "Recovery disputed"
    assert hr_note.message == f"Hafiz Rahman disputed the recovery on claim RC-{str(reim.reim_id)[:8]}."

    act_as("hr")
    _close_window(db, rid)
    _no_paypal(monkeypatch)
    resp = client.post(f"/api/v1/recoveries/{rid}/execute")
    assert resp.status_code == 409 and resp.json() == {"detail": "DISPUTED"}
    assert client.get(f"/api/v1/recoveries/{rid}/invoice-preview").json() == {"detail": "DISPUTED"}

    resp = client.post(f"/api/v1/recoveries/{rid}/waive")
    assert resp.status_code == 200 and resp.json()["status"] == "WAIVED"
    assert client.post(f"/api/v1/recoveries/{rid}/waive").status_code == 409

    transitions = [(a.payload["from"], a.payload["to"]) for a in _actions(db, "RECOVERY_STATUS")]
    assert transitions == [("NOTICE_SENT", "DISPUTED"), ("DISPUTED", "WAIVED")]
    assert _notes(db, users["emp"])[-1].title == "Recovery waived"
    assert verify_chain(db)


def test_waive_before_execute(env):
    client, db, users, _ = env
    rec = _open(client, _claim(db, users["emp"]))
    resp = client.post(f"/api/v1/recoveries/{rec['recovery_id']}/waive")
    assert resp.status_code == 200 and resp.json()["status"] == "WAIVED"
    assert client.post(f"/api/v1/recoveries/{rec['recovery_id']}/execute").json() == {"detail": "NOT_EXECUTABLE"}


def test_dispute_after_the_window_is_refused(env):
    client, db, users, act_as = env
    rec = _open(client, _claim(db, users["emp"]))
    _close_window(db, rec["recovery_id"])
    act_as("emp")
    resp = client.post(f"/api/v1/recoveries/{rec['recovery_id']}/dispute", json={"note": "late"})
    assert resp.status_code == 409 and resp.json() == {"detail": "DISPUTE_WINDOW_CLOSED"}


def test_offset_uses_the_oldest_claim_that_covers_the_amount(env, monkeypatch):
    client, db, users, _ = env
    emp = users["emp"]
    paid = _claim(db, emp, days_ago=30)
    _claim(db, emp, status="APPROVED", amount=10.0, days_ago=9)            # oldest, too small
    target = _claim(db, emp, status="REVIEW", amount=48.0, days_ago=5)     # oldest that covers 30
    _claim(db, emp, status="APPROVED", amount=100.0, days_ago=2)
    _claim(db, emp, status="PAID", amount=500.0, days_ago=20)              # already paid
    _claim(db, users["other"], status="APPROVED", amount=500.0, days_ago=40)  # someone else's
    rec = _open(client, paid)
    _close_window(db, rec["recovery_id"])
    _no_paypal(monkeypatch)

    preview = client.get(f"/api/v1/recoveries/{rec['recovery_id']}/invoice-preview").json()
    assert preview["path"] == "OFFSET"
    resp = client.post(f"/api/v1/recoveries/{rec['recovery_id']}/execute")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "OFFSET" and body["offset_reim_id"] == str(target.reim_id)
    assert body["paypal_invoice_id"] is None

    net, applied = offset_for_reim(db, db.get(Reimbursement, target.reim_id))
    assert net == Decimal("18.00") and [str(i) for i in applied] == [rec["recovery_id"]]
    # The next payout for that claim is the reduced amount.
    assert payout_plan("APPROVED", net, [], True) == ("CREATE", Decimal("18.00"), 1)

    (logged,) = _actions(db, "RECOVERY_STATUS")
    assert logged.payload["to"] == "OFFSET" and logged.payload["offset_reim_id"] == str(target.reim_id)
    assert _notes(db, emp)[-1].title == "Overpayment deducted"


def test_an_offset_claim_is_not_reused_beyond_its_amount(env, monkeypatch):
    client, db, users, _ = env
    emp = users["emp"]
    target = _claim(db, emp, status="APPROVED", amount=50.0, days_ago=3)
    first = _open(client, _claim(db, emp, days_ago=30))
    second = _open(client, _claim(db, emp, days_ago=29))
    for rec in (first, second):
        _close_window(db, rec["recovery_id"])
    _no_paypal(monkeypatch)

    assert client.post(f"/api/v1/recoveries/{first['recovery_id']}/execute").json()["status"] == "OFFSET"
    # Only 20.00 is left on the target, so the second one needs an invoice and therefore a preview.
    assert client.post(f"/api/v1/recoveries/{second['recovery_id']}/execute").json() == {"detail": "PREVIEW_REQUIRED"}
    assert offset_for_reim(db, db.get(Reimbursement, target.reim_id))[0] == Decimal("20.00")


def test_invoice_in_mock_mode_after_preview(env):
    client, db, users, _ = env
    reim = _claim(db, users["emp"])
    rec = _open(client, reim)
    rid = rec["recovery_id"]
    _close_window(db, rid)
    ref = f"RC-{str(reim.reim_id)[:8]}"

    resp = client.post(f"/api/v1/recoveries/{rid}/execute")
    assert resp.status_code == 409 and resp.json() == {"detail": "PREVIEW_REQUIRED"}

    preview = client.get(f"/api/v1/recoveries/{rid}/invoice-preview").json()
    assert preview == {"note": fallback_note(REASON, Decimal("30.00"), "MYR", ref), "amount": 30.0,
                       "currency": "MYR", "recipient_email_masked": "h***@example.com", "path": "INVOICE"}

    resp = client.post(f"/api/v1/recoveries/{rid}/execute")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "INVOICED" and body["paypal_invoice_id"].startswith("INV2-")
    assert body["offset_reim_id"] is None

    (logged,) = _actions(db, "RECOVERY_INVOICED")
    assert logged.payload == {"recovery_id": rid, "invoice_id": body["paypal_invoice_id"]}
    note = _notes(db, users["emp"])[-1]
    assert (note.title, note.message) == ("PayPal invoice sent",
                                          f"We sent a PayPal invoice for MYR 30.00 for claim {ref}.")

    assert client.post(f"/api/v1/recoveries/{rid}/execute").json() == {"detail": "NOT_EXECUTABLE"}
    assert client.post(f"/api/v1/recoveries/{rid}/waive").json() == {"detail": "NOT_WAIVABLE"}

    mark_recovered(db, body["paypal_invoice_id"])
    mark_recovered(db, body["paypal_invoice_id"])
    assert db.get(Recovery, rid).status == "RECOVERED"
    assert [a.payload["to"] for a in _actions(db, "RECOVERY_STATUS")] == ["RECOVERED"]
    assert verify_chain(db)


def test_invoice_sends_the_previewed_note_to_the_work_email_fallback(env, monkeypatch):
    client, db, users, _ = env
    users["emp"].paypal_email = None
    db.add(users["emp"])
    db.commit()
    rec = _open(client, _claim(db, users["emp"]))
    _close_window(db, rec["recovery_id"])
    sent = []

    async def capture(payload):
        sent.append(payload)
        return "INV2-TEST-0000-0000-0001"
    monkeypatch.setattr(paypal_invoicing, "create_and_send_invoice", capture)

    preview = client.get(f"/api/v1/recoveries/{rec['recovery_id']}/invoice-preview").json()
    assert preview["recipient_email_masked"] == "H***@test.local"
    assert client.post(f"/api/v1/recoveries/{rec['recovery_id']}/execute").json()["status"] == "INVOICED"
    (payload,) = sent
    assert payload["detail"]["note"] == preview["note"]
    assert payload["primary_recipients"][0]["billing_info"]["email_address"] == users["emp"].email
    assert payload["detail"]["invoice_number"] == f"RCV-{rec['recovery_id'].replace('-', '')}"


def test_a_changed_recipient_after_preview_needs_a_new_preview(env, monkeypatch):
    client, db, users, _ = env
    rec = _open(client, _claim(db, users["emp"]))
    _close_window(db, rec["recovery_id"])
    client.get(f"/api/v1/recoveries/{rec['recovery_id']}/invoice-preview")
    users["emp"].paypal_email = "someone.else@example.org"
    db.add(users["emp"])
    db.commit()
    _no_paypal(monkeypatch)
    assert client.post(f"/api/v1/recoveries/{rec['recovery_id']}/execute").json() == {"detail": "PREVIEW_STALE"}


def test_paypal_failure_leaves_the_recovery_open(env, monkeypatch):
    from engine.services.paypal_client import PayPalError

    client, db, users, _ = env
    rec = _open(client, _claim(db, users["emp"]))
    _close_window(db, rec["recovery_id"])
    client.get(f"/api/v1/recoveries/{rec['recovery_id']}/invoice-preview")

    async def fail(payload):
        raise PayPalError(500, "INTERNAL_SERVER_ERROR")
    monkeypatch.setattr(paypal_invoicing, "create_and_send_invoice", fail)

    resp = client.post(f"/api/v1/recoveries/{rec['recovery_id']}/execute")
    assert resp.status_code == 502 and resp.json() == {"detail": "PAYPAL_INVOICE_FAILED"}
    assert db.get(Recovery, rec["recovery_id"]).status == "NOTICE_SENT"
    assert _actions(db, "RECOVERY_INVOICED") == []


def test_employees_see_and_dispute_only_their_own(env):
    client, db, users, act_as = env
    mine = _open(client, _claim(db, users["emp"]))
    theirs = _open(client, _claim(db, users["other"]))

    act_as("emp")
    listed = client.get("/api/v1/recoveries").json()
    assert [r["recovery_id"] for r in listed] == [mine["recovery_id"]]
    assert client.get("/api/v1/recoveries", params={"reim_id": theirs["reim_id"]}).json() == []
    resp = client.post(f"/api/v1/recoveries/{theirs['recovery_id']}/dispute", json={"note": "not mine"})
    assert resp.status_code == 404
    assert db.get(Recovery, theirs["recovery_id"]).status == "NOTICE_SENT"

    act_as("hr")
    all_ids = {r["recovery_id"] for r in client.get("/api/v1/recoveries", params={"status": "NOTICE_SENT"}).json()}
    assert {mine["recovery_id"], theirs["recovery_id"]} <= all_ids
    disputed = client.get("/api/v1/recoveries", params={"status": "DISPUTED"}).json()
    assert mine["recovery_id"] not in {r["recovery_id"] for r in disputed}
    assert all(r["status"] == "DISPUTED" for r in disputed)


def test_hr_only_routes_return_403_for_employees(env, monkeypatch):
    client, db, users, act_as = env
    reim = _claim(db, users["emp"])
    rec = _open(client, reim)
    _close_window(db, rec["recovery_id"])
    _no_paypal(monkeypatch)

    act_as("emp")
    rid = rec["recovery_id"]
    assert client.post("/api/v1/recoveries", json={"reim_id": str(reim.reim_id), "amount": 1,
                                                    "reason": "x"}).status_code == 403
    assert client.get(f"/api/v1/recoveries/{rid}/invoice-preview").status_code == 403
    assert client.post(f"/api/v1/recoveries/{rid}/execute").status_code == 403
    assert client.post(f"/api/v1/recoveries/{rid}/waive").status_code == 403
    assert db.get(Recovery, rid).status == "NOTICE_SENT"


def test_hr_cannot_waive_their_own_recovery(env):
    client, db, users, act_as = env
    hr2 = _user(db, UserRole.HR, "hr2")
    reim = _claim(db, hr2)
    rec = _open(client, reim)
    users["hr2"] = hr2
    act_as("hr2")
    assert client.post(f"/api/v1/recoveries/{rec['recovery_id']}/waive").json() == {"detail": "SELF_RECOVERY"}
