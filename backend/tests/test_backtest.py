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
