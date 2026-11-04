from datetime import datetime, timezone

import pytest
from core.models import Payout
from engine.services import payout_service
from engine.services.approvals import approvals_complete
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
