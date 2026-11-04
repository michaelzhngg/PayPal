from uuid import uuid4

import pytest
from sqlmodel import select

from api import reimbursements
from core.enums import UserRole
from core.models import Notification, User

TITLE = "Claim submitted for review"


@pytest.fixture
def employee(pg_db, monkeypatch):
    monkeypatch.setattr(reimbursements, "fire_and_forget_push", lambda *a, **k: None)
    user = User(email=f"{uuid4().hex[:8]}@test.local", hashed_password="x", name="emp", role=UserRole.Employee)
    pg_db.add(user)
    pg_db.commit()
    pg_db.refresh(user)
    return user


def _for_review(db, user):
    return db.exec(select(Notification).where(Notification.user_id == user.user_id,
                                              Notification.title == TITLE)).all()


@pytest.mark.parametrize("status", ["APPROVED", "DISBURSING", "PAID"])
def test_auto_paid_claim_gets_no_for_review_message(pg_db, employee, status):
    reimbursements._notify_claims_for_review(pg_db, employee.user_id, [{"tier": "AUTO_PAY", "status": status}])
    assert _for_review(pg_db, employee) == []


def test_claim_waiting_for_hr_gets_the_message(pg_db, employee):
    reimbursements._notify_claims_for_review(pg_db, employee.user_id, [{"tier": "HR_QUICK", "status": "REVIEW"}])
    (note,) = _for_review(pg_db, employee)
    assert "1 receipt for processing" in note.message


def test_mixed_submission_counts_only_the_claims_waiting_for_hr(pg_db, employee):
    results = [{"tier": "AUTO_PAY", "status": "PAID"}, {"tier": "HR_REVIEW", "status": "REVIEW"},
               {"tier": "DUAL_REVIEW", "status": "REVIEW"}]
    reimbursements._notify_claims_for_review(pg_db, employee.user_id, results)
    (note,) = _for_review(pg_db, employee)
    assert "2 receipts for processing" in note.message
