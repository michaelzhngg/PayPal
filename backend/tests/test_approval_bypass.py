from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import select

from api import deps, reimbursements
from api.rate_limit import limiter
from core.enums import UserRole
from core.models import (
    LineItem, Notification, Payout, Policy, PolicyReimbursableCategory, Recovery, Reimbursement,
    SettlementReceipt, SupportingDocument, TravelSettlement, User,
)
from engine.services import payout_service
from engine.services.approvals import approvals_complete, required_approvals
from engine.services.paypal_client import PayoutCreated
from tests.test_approvals_api import _claim, env  # noqa: F401


class FakePayPal:
    def __init__(self):
        self.calls = []

    async def create_payout(self, **kwargs):
        self.calls.append(kwargs)
        return PayoutCreated(batch_id=f"BATCH-{len(self.calls)}", batch_status="PENDING")


@pytest.fixture
def paypal(monkeypatch):
    fake = FakePayPal()
    monkeypatch.setattr(payout_service, "get_paypal_client", lambda: fake)
    monkeypatch.setattr(payout_service, "_schedule_status_refresh", lambda *a, **k: None)
    monkeypatch.setattr(payout_service, "fire_and_forget_push", lambda *a, **k: None)
    return fake


def _verify_payee(db, user):
    user.paypal_verified = True
    user.paypal_payer_id = "PAYER123"
    user.paypal_email = "payee@test.local"
    db.add(user)
    db.commit()


def _approvals(*users):
    return [{"hr_id": str(u.user_id), "at": datetime.now(timezone.utc).isoformat()} for u in users]


def _failed_payout(db, claim, status="FAILED", attempt=1):
    db.add(Payout(reim_id=claim.reim_id, user_id=claim.user_id, amount=80, currency="MYR", status=status,
                  provider="PAYPAL", attempt=attempt, idempotency_key=f"key-{claim.reim_id}-{attempt}",
                  reference_id="RC-test", channel_code="PAYPAL"))
    db.commit()


def _paid_claim_state(db, claim, status, approvals):
    claim.status = status
    claim.approvals = approvals
    db.add(claim)
    db.commit()


@pytest.mark.parametrize("forged", ["DISBURSEMENT_FAILED", "DISBURSING", "PAID", "PENDING", "APPEALED", "nonsense"])
def test_patch_refuses_anything_but_an_hr_decision(env, forged):  # noqa: F811
    c, db, users, _ = env
    r = _claim(db, users["emp"], "DUAL_REVIEW", amount=1200)
    res = c.patch(f"/api/v1/reimbursements/{r.reim_id}/status", json={"status": forged})
    assert res.status_code == 422
    db.refresh(r)
    assert r.status == "REVIEW" and r.reviewed_by is None


@pytest.mark.parametrize("decision,expected", [("REJECTED", "REJECTED"), ("REVIEW", "REVIEW")])
def test_patch_still_takes_the_decisions_the_hr_pages_send(env, decision, expected):  # noqa: F811
    c, db, users, _ = env
    r = _claim(db, users["emp"], "HR_REVIEW")
    res = c.patch(f"/api/v1/reimbursements/{r.reim_id}/status", json={"status": decision})
    assert res.status_code == 200 and res.json()["status"] == expected


def test_one_hr_user_cannot_pay_a_forged_failure(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _claim(db, users["emp"], "DUAL_REVIEW", amount=1200)
    _paid_claim_state(db, r, "DISBURSEMENT_FAILED", _approvals(users["hr1"]))
    res = c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)})
    assert res.status_code == 409
    assert paypal.calls == []


def test_failed_status_without_a_failed_payout_is_not_a_retry(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _claim(db, users["emp"], "HR_REVIEW")
    _paid_claim_state(db, r, "DISBURSEMENT_FAILED", _approvals(users["hr1"]))
    assert c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)}).status_code == 409
    assert paypal.calls == []


def test_half_approved_dual_claim_cannot_be_paid(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _claim(db, users["emp"], "DUAL_REVIEW", amount=1200)
    _paid_claim_state(db, r, "APPROVED", _approvals(users["hr1"]))
    assert c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)}).status_code == 409
    assert paypal.calls == []


def test_hr_cannot_pay_their_own_claim(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["hr1"])
    r = _claim(db, users["hr1"], "HR_REVIEW")
    _paid_claim_state(db, r, "APPROVED", _approvals(users["hr2"]))
    res = c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)})
    assert res.status_code == 403 and res.json()["detail"] == "SELF_APPROVAL"
    assert paypal.calls == []


@pytest.mark.parametrize("failure", ["FAILED", "CANCELLED", "REVERSED"])
def test_resend_after_a_real_failure_pays_the_next_attempt(env, paypal, failure):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _claim(db, users["emp"], "DUAL_REVIEW", amount=1200)
    _paid_claim_state(db, r, "DISBURSEMENT_FAILED", _approvals(users["hr1"], users["hr2"]))
    _failed_payout(db, r, status=failure)
    res = c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)})
    assert res.status_code == 200 and res.json()["attempt"] == 2
    assert len(paypal.calls) == 1


def test_auto_paid_claim_can_be_resent_without_hr_approvals(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _claim(db, users["emp"], "AUTO_PAY", status="APPROVED")
    res = c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)})
    assert res.status_code == 200 and len(paypal.calls) == 1


def test_fully_approved_claim_pays(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _claim(db, users["emp"], "HR_REVIEW")
    _paid_claim_state(db, r, "APPROVED", _approvals(users["hr1"]))
    assert c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)}).status_code == 200


def test_legacy_claim_counts_its_recorded_reviewer(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    unreviewed = _claim(db, users["emp"], None, status="APPROVED")
    assert c.post("/api/v1/payouts/", json={"reim_id": str(unreviewed.reim_id)}).status_code == 409

    reviewed = _claim(db, users["emp"], None, status="APPROVED")
    reviewed.reviewed_by = users["hr2"].user_id
    db.add(reviewed)
    db.commit()
    assert c.post("/api/v1/payouts/", json={"reim_id": str(reviewed.reim_id)}).status_code == 200


def test_approvals_complete_rules():
    hr1, hr2, emp = {"hr_id": "hr1"}, {"hr_id": "hr2"}, {"hr_id": "emp"}
    assert approvals_complete("AUTO_PAY", [], "emp")
    assert approvals_complete("HR_QUICK", [hr1], "emp")
    assert not approvals_complete("HR_QUICK", [], "emp")
    assert not approvals_complete("HR_REVIEW", [emp], "emp")
    assert not approvals_complete("DUAL_REVIEW", [hr1], "emp")
    assert not approvals_complete("DUAL_REVIEW", [hr1, hr1], "emp")
    assert not approvals_complete("DUAL_REVIEW", [hr1, emp], "emp")
    assert approvals_complete("DUAL_REVIEW", [hr1, hr2], "emp")
    assert approvals_complete(None, [], "emp", reviewed_by="hr1")
    assert not approvals_complete(None, [], "emp", reviewed_by="emp")
    assert not approvals_complete("HR_REVIEW", [], "emp", reviewed_by="hr1")


def _without_line_items(db, claim):
    for li in db.exec(select(LineItem).where(LineItem.reim_id == claim.reim_id)).all():
        db.delete(li)
    claim.total_approved_amount = None
    db.add(claim)
    db.commit()
    return claim


def _notes(db, user):
    return db.exec(select(Notification).where(Notification.user_id == user.user_id)).all()


@pytest.fixture
def analyze_env(pg_db, monkeypatch):
    """Runs /analyze's background job for real, on the test transaction's connection."""
    pool = ThreadPoolExecutor(max_workers=1)
    monkeypatch.setattr(reimbursements, "_executor", pool)
    monkeypatch.setattr(reimbursements, "db_engine", pg_db.get_bind())
    monkeypatch.setattr(reimbursements, "fire_and_forget_push", lambda *a, **k: None)
    employee = User(email=f"emp-{uuid4().hex[:8]}@test.local", hashed_password="x", name="emp", role=UserRole.Employee)
    pg_db.add(employee)
    pg_db.commit()
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(reimbursements.router, prefix="/reimbursements")
    app.dependency_overrides[deps.get_db] = lambda: pg_db
    app.dependency_overrides[deps.get_current_user] = lambda: employee
    with TestClient(app) as client:
        yield client, pg_db, employee, pool
    pool.shutdown(wait=True)


def _receipt(db, employee, settlement, category, amount):
    doc = SupportingDocument(user_id=employee.user_id, name=f"{category}.jpg", path=f"/storage/{category}.jpg",
                             type="image", extracted_data={}, settlement_id=settlement.settlement_id)
    db.add(doc)
    db.flush()
    db.add(SettlementReceipt(settlement_id=settlement.settlement_id, document_id=doc.document_id, merchant_name="Shop",
                             receipt_date=date(2026, 11, 3), category=category, claimed_amount=amount, currency="MYR"))
    db.flush()


def test_claims_that_skip_decide_need_two_people(analyze_env, monkeypatch):
    client, db, employee, pool = analyze_env
    hr = User(email=f"hr-{uuid4().hex[:8]}@test.local", hashed_password="x", name="hr", role=UserRole.HR)
    db.add(hr)
    db.flush()
    policy = Policy(alias=f"T-{uuid4().hex[:8]}", title="Test policy", effective_date=datetime.now(timezone.utc),
                    overview_summary="", mandatory_conditions="{}", source_file_url="", status="ACTIVE",
                    created_by=hr.user_id)
    db.add(policy)
    db.flush()
    db.add(PolicyReimbursableCategory(policy_id=policy.policy_id, category="Covered"))
    settlement = TravelSettlement(user_id=employee.user_id, currency="MYR", total_claimed_amount=1500.0)
    db.add(settlement)
    db.flush()
    _receipt(db, employee, settlement, "NoPolicy", 900.0)
    _receipt(db, employee, settlement, "Covered", 600.0)
    db.commit()

    def shield_crash(**kwargs):
        raise RuntimeError("shield crashed")

    monkeypatch.setattr(reimbursements, "run_compliance_workflow", shield_crash)
    res = client.post("/reimbursements/analyze", json={"settlement_id": str(settlement.settlement_id)})
    assert res.status_code == 200
    pool.shutdown(wait=True)

    db.expire_all()
    claims = db.exec(select(Reimbursement).where(Reimbursement.settlement_id == settlement.settlement_id)).all()
    assert {float(c.total_claimed_amount) for c in claims} == {900.0, 600.0}
    for claim in claims:
        assert claim.status == "REVIEW" and claim.tier == "DUAL_REVIEW"
        assert required_approvals(claim.tier) == 2


def test_approving_a_claim_with_nothing_approved_is_refused(env):  # noqa: F811
    c, db, users, _ = env
    r = _without_line_items(db, _claim(db, users["emp"], "DUAL_REVIEW", amount=900))
    res = c.patch(f"/api/v1/reimbursements/{r.reim_id}/status", json={"status": "APPROVED"})
    assert res.status_code == 409 and res.json()["detail"] == "NOTHING_TO_PAY"
    db.refresh(r)
    assert r.status == "REVIEW" and r.approvals == []
    assert _notes(db, users["emp"]) == []


def test_claim_with_nothing_approved_can_still_be_rejected(env):  # noqa: F811
    c, db, users, _ = env
    r = _without_line_items(db, _claim(db, users["emp"], "DUAL_REVIEW", amount=900))
    res = c.patch(f"/api/v1/reimbursements/{r.reim_id}/status",
                  json={"status": "REJECTED", "hr_note": "No policy covers this"})
    assert res.status_code == 200 and res.json()["status"] == "REJECTED"


def test_hr_amounts_make_a_zero_claim_approvable(env):  # noqa: F811
    c, db, users, _ = env
    r = _claim(db, users["emp"], "HR_REVIEW", amount=80)
    line = db.exec(select(LineItem).where(LineItem.reim_id == r.reim_id)).one()
    line.approved_amount = 0
    line.judgment = "NEEDS_INFO"
    db.add(line)
    db.commit()
    url = f"/api/v1/reimbursements/{r.reim_id}/status"
    assert c.patch(url, json={"status": "APPROVED"}).status_code == 409
    body = c.patch(url, json={"status": "APPROVED", "line_items": [
        {"line_item_id": str(line.line_item_id), "approved_amount": 50}]}).json()
    assert body["status"] == "APPROVED" and body["total_approved_amount"] == 50


def test_batch_skips_a_claim_with_nothing_approved(env):  # noqa: F811
    c, db, users, _ = env
    r = _without_line_items(db, _claim(db, users["emp"], "HR_QUICK"))
    body = c.post("/api/v1/reimbursements/batch-approve", json={"reim_ids": [str(r.reim_id)]}).json()
    assert body == {"approved": [], "skipped": [{"reim_id": str(r.reim_id), "reason": "NOTHING_TO_PAY"}]}
    db.refresh(r)
    assert r.status == "REVIEW" and r.approvals == []


def test_zero_payout_without_an_offset_never_marks_paid(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _without_line_items(db, _claim(db, users["emp"], "HR_REVIEW", status="APPROVED"))
    r.approvals = _approvals(users["hr1"])
    db.add(r)
    db.commit()

    res = c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)})
    assert res.status_code == 400 and "no amount was approved" in res.json()["detail"]
    assert payout_service.initiate_payout_sync(r.reim_id, db) is None
    db.refresh(r)
    assert r.status == "APPROVED"
    assert _notes(db, users["emp"]) == [] and paypal.calls == []


def test_claim_fully_covered_by_an_offset_settles_as_paid(env, paypal):  # noqa: F811
    c, db, users, _ = env
    _verify_payee(db, users["emp"])
    r = _claim(db, users["emp"], "HR_REVIEW", status="APPROVED", amount=30)
    r.approvals = _approvals(users["hr1"])
    source = _claim(db, users["emp"], "AUTO_PAY", status="PAID", amount=30)
    db.add(Recovery(reim_id=source.reim_id, user_id=users["emp"].user_id, amount=30, currency="MYR", reason="Overpaid",
                    status="OFFSET", offset_reim_id=r.reim_id, dispute_until=datetime.now(timezone.utc),
                    created_by=users["hr1"].user_id))
    db.commit()

    res = c.post("/api/v1/payouts/", json={"reim_id": str(r.reim_id)})
    assert res.status_code == 400 and "earlier overpayment" in res.json()["detail"]
    db.refresh(r)
    assert r.status == "PAID" and paypal.calls == []
    assert [n.title for n in _notes(db, users["emp"])] == [f"Claim RC-{str(r.reim_id)[:8]} settled"]
