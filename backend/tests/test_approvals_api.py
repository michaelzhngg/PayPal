from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import select

from api import deps
from core.enums import UserRole
from core.models import AgentAction, LineItem, Reimbursement, User
from engine.services.action_log import verify_chain

MARK = "approvals-api-test"
DECISION = {
    "tier": "HR_QUICK", "risk_score": 25, "confidence_points": 0, "trust_tier": "STANDARD",
    "auto_limit": 100.0, "hard_stops": ["OVER_AUTO_LIMIT"],
    "signals": [{"code": "NEAR_THRESHOLD", "severity": "LOW", "points": 10, "message": "Just under the limit"}],
    "expected_loss": 2.5, "explanation": "Quick HR approval: above the Standard limit.",
    "audit_selected": False, "config_version": 1,
}


def _user(db, role, name):
    u = User(email=f"{name}-{uuid4().hex[:8]}@test.local", hashed_password="x", name=name, role=role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def env(pg_db):
    from main import app

    db = pg_db
    db.exec(text("DELETE FROM agent_actions"))
    users = {
        "hr1": _user(db, UserRole.HR, "hr1"),
        "hr2": _user(db, UserRole.HR, "hr2"),
        "emp": _user(db, UserRole.Employee, "emp"),
    }
    acting = {"user": users["hr1"]}
    app.dependency_overrides[deps.get_db] = lambda: db
    app.dependency_overrides[deps.get_current_user] = lambda: acting["user"]

    def act_as(name):
        acting["user"] = users[name]

    try:
        yield TestClient(app), db, users, act_as
    finally:
        app.dependency_overrides.clear()


def _claim(db, owner, tier, status="REVIEW", amount=80, autonomy=None, audit=False):
    now = datetime.now(timezone.utc)
    r = Reimbursement(
        user_id=owner.user_id, main_category="Meals", currency="MYR",
        total_claimed_amount=amount, total_approved_amount=amount, judgment="APPROVED",
        summary=MARK, ai_reasoning={"verdict": "looks fine", "hr_note": "Checked with the hotel"},
        status=status, tier=tier, risk_score=25 if tier else None,
        autonomy=autonomy if autonomy is not None else ({**DECISION, "tier": tier} if tier else {}),
        audit_selected=audit, created_at=now, updated_at=now,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    db.add(LineItem(reim_id=r.reim_id, description="Dinner", category="Meals", claimed_amount=amount,
                    approved_amount=amount, currency="MYR", judgment="APPROVED",
                    rejection_reason="AI: amount within cap"))
    db.commit()
    return r


def _approvals_logged(db, reim_id):
    return db.exec(select(AgentAction).where(AgentAction.reim_id == reim_id,
                                             AgentAction.action_type == "HR_APPROVAL")).all()


def test_hr_cannot_approve_own_claim(env):
    c, db, users, act_as = env
    r = _claim(db, users["hr1"], "HR_REVIEW")
    res = c.patch(f"/api/v1/reimbursements/{r.reim_id}/status", json={"status": "APPROVED"})
    assert res.status_code == 403 and res.json()["detail"] == "SELF_APPROVAL"
    db.refresh(r)
    assert r.status == "REVIEW" and r.approvals == []
    assert _approvals_logged(db, r.reim_id) == []


def test_dual_review_needs_two_different_hr(env):
    c, db, users, act_as = env
    r = _claim(db, users["emp"], "DUAL_REVIEW", amount=1200)
    url = f"/api/v1/reimbursements/{r.reim_id}/status"

    first = c.patch(url, json={"status": "APPROVED"}).json()
    assert first["status"] == "REVIEW" and first["awaiting_second_approval"] is True
    assert first["ready_for_payout"] is False
    assert [a["hr_id"] for a in first["approvals"]] == [str(users["hr1"].user_id)]

    again = c.patch(url, json={"status": "APPROVED"})
    assert again.status_code == 409 and again.json()["detail"] == "ALREADY_APPROVED"

    act_as("hr2")
    second = c.patch(url, json={"status": "APPROVED"}).json()
    assert second["status"] == "APPROVED" and "awaiting_second_approval" not in second
    assert {a["hr_id"] for a in second["approvals"]} == {str(users["hr1"].user_id), str(users["hr2"].user_id)}
    assert second["reviewed_by"] == str(users["hr2"].user_id)

    logged = _approvals_logged(db, r.reim_id)
    assert [a.payload["complete"] for a in logged] == [False, True]
    assert verify_chain(db) is True


def test_single_approval_tier_approves_at_once(env):
    c, db, users, _ = env
    r = _claim(db, users["emp"], "HR_REVIEW")
    body = c.patch(f"/api/v1/reimbursements/{r.reim_id}/status", json={"status": "APPROVED"}).json()
    assert body["status"] == "APPROVED" and body["ready_for_payout"] is True
    assert len(_approvals_logged(db, r.reim_id)) == 1


def test_batch_approve_skips_with_reasons(env):
    c, db, users, _ = env
    a = _claim(db, users["emp"], "HR_QUICK")
    b = _claim(db, users["emp"], "HR_REVIEW")
    cc = _claim(db, users["emp"], "HR_QUICK", status="PAID")
    d = _claim(db, users["hr1"], "HR_QUICK")
    old = _claim(db, users["emp"], None)
    missing = str(uuid4())
    ids = [str(x.reim_id) for x in (a, b, cc, d, old)] + [missing, "not-a-uuid"]

    body = c.post("/api/v1/reimbursements/batch-approve", json={"reim_ids": ids}).json()
    assert body["approved"] == [str(a.reim_id)]
    assert {s["reim_id"]: s["reason"] for s in body["skipped"]} == {
        str(b.reim_id): "NOT_HR_QUICK", str(cc.reim_id): "NOT_IN_REVIEW", str(d.reim_id): "SELF_APPROVAL",
        str(old.reim_id): "NOT_HR_QUICK", missing: "NOT_HR_QUICK", "not-a-uuid": "NOT_HR_QUICK",
    }
    db.refresh(a)
    assert a.status == "APPROVED" and a.approvals[0]["hr_id"] == str(users["hr1"].user_id)
    logged = _approvals_logged(db, a.reim_id)
    assert len(logged) == 1 and logged[0].payload["batch"] is True


def test_batch_approve_is_hr_only(env):
    c, db, users, act_as = env
    a = _claim(db, users["hr1"], "HR_QUICK")
    act_as("emp")
    assert c.post("/api/v1/reimbursements/batch-approve", json={"reim_ids": [str(a.reim_id)]}).status_code == 403


def test_employee_response_has_no_judgment_text(env):
    c, db, users, act_as = env
    r = _claim(db, users["emp"], "HR_QUICK")
    act_as("emp")

    detail = c.get(f"/api/v1/reimbursements/{r.reim_id}").json()
    listed = next(x for x in c.get("/api/v1/reimbursements/").json() if x["reim_id"] == str(r.reim_id))
    for body in (detail, listed):
        assert body["summary"] is None
        assert body["ai_reasoning"] == {"hr_note": "Checked with the hotel"}
        assert body["tier"] == "HR_QUICK" and body["approvals"] == []
        assert "explanation" not in body["autonomy"] and "signals" not in body["autonomy"]
        assert "hard_stops" not in body["autonomy"]
        assert body["autonomy"]["tier"] == "HR_QUICK"
        assert "employee_code" in body and "merchant_names" in body
    assert detail["line_items"][0]["rejection_reason"] is None
    items = c.get(f"/api/v1/reimbursements/{r.reim_id}/line-items").json()
    assert items[0]["rejection_reason"] is None

    act_as("hr1")
    hr_view = c.get(f"/api/v1/reimbursements/{r.reim_id}").json()
    assert hr_view["summary"] == MARK and hr_view["ai_reasoning"]["verdict"] == "looks fine"
    assert hr_view["autonomy"]["explanation"].startswith("Quick HR approval")
    assert hr_view["autonomy"]["signals"][0]["code"] == "NEAR_THRESHOLD"
    assert hr_view["line_items"][0]["rejection_reason"] == "AI: amount within cap"


def test_list_filters_and_null_safe_old_claims(env):
    c, db, users, _ = env
    quick = _claim(db, users["emp"], "HR_QUICK", audit=True)
    old = _claim(db, users["emp"], None, autonomy={})

    by_tier = c.get("/api/v1/reimbursements/?tier=HR_QUICK&audit_selected=true&limit=500").json()
    ids = {x["reim_id"] for x in by_tier}
    assert str(quick.reim_id) in ids and str(old.reim_id) not in ids
    assert all(x["tier"] == "HR_QUICK" and x["audit_selected"] is True for x in by_tier)

    old_body = c.get(f"/api/v1/reimbursements/{old.reim_id}").json()
    assert old_body["tier"] is None and old_body["risk_score"] is None
    assert old_body["autonomy"] == {} and old_body["approvals"] == [] and old_body["audit_selected"] is False
