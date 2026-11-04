from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from core.enums import JudgmentResult, RecoveryStatus, ReimbursementStatus, UserRole
from core.models import Recovery, Reimbursement, User
from engine.risk.autonomy import trust_tier
from engine.risk.types import TrustTier
from engine.services.autonomy_store import employee_history
from engine.services.backtest_service import load_backtest_cases

NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)
RESOLVED = (RecoveryStatus.OFFSET, RecoveryStatus.INVOICED, RecoveryStatus.RECOVERED)
UNRESOLVED = (RecoveryStatus.NOTICE_SENT, RecoveryStatus.DISPUTED, RecoveryStatus.WAIVED)


def _employee(db):
    u = User(email=f"emp-{uuid4().hex[:8]}@test.local", hashed_password="x", name="emp", role=UserRole.Employee)
    db.add(u)
    db.flush()
    return u


def _paid_claim(db, user, days_ago=20):
    at = NOW - timedelta(days=days_ago)
    r = Reimbursement(user_id=user.user_id, main_category="Meals", currency="MYR", total_claimed_amount=40,
                      total_approved_amount=40, judgment=JudgmentResult.APPROVED, summary="", confidence=0.9,
                      status=ReimbursementStatus.PAID, tier="AUTO_PAY",
                      autonomy={"tier": "AUTO_PAY", "signals": [], "hard_stops": []}, created_at=at, updated_at=at)
    db.add(r)
    db.flush()
    return r


def _recovery(db, user, claim, status):
    db.add(Recovery(reim_id=claim.reim_id, user_id=user.user_id, amount=10, currency="MYR", reason="Overpaid",
                    status=status, dispute_until=NOW, created_by=user.user_id, created_at=NOW - timedelta(days=5),
                    updated_at=NOW - timedelta(days=5)))
    db.commit()


@pytest.mark.parametrize("status,counted", [(s, True) for s in RESOLVED] + [(s, False) for s in UNRESOLVED])
def test_only_a_resolved_recovery_is_a_confirmed_issue(pg_db, status, counted):
    user = _employee(pg_db)
    _recovery(pg_db, user, _paid_claim(pg_db, user), status)
    assert employee_history(pg_db, user.user_id, NOW).confirmed_issues_90d == (1 if counted else 0)


def test_a_disputed_notice_does_not_cut_trust(pg_db):
    user = _employee(pg_db)
    claims = [_paid_claim(pg_db, user, days_ago=20 + i) for i in range(3)]
    _recovery(pg_db, user, claims[0], RecoveryStatus.DISPUTED)
    assert trust_tier(employee_history(pg_db, user.user_id, NOW)) == TrustTier.STANDARD


@pytest.mark.parametrize("status,counted", [(s, True) for s in RESOLVED] + [(s, False) for s in UNRESOLVED])
def test_backtest_shares_the_rule(pg_db, status, counted):
    user = _employee(pg_db)
    claim = _paid_claim(pg_db, user)
    later = _paid_claim(pg_db, user, days_ago=1)
    _recovery(pg_db, user, claim, status)
    cases = {c.claim.reim_id: c for c in load_backtest_cases(pg_db, NOW)}
    assert cases[str(claim.reim_id)].bad is counted
    assert cases[str(later.reim_id)].history.confirmed_issues_90d == (1 if counted else 0)
