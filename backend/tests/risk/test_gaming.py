from datetime import date, datetime, timedelta, timezone

from engine.risk.shield.gaming import detect_near_threshold, detect_split, normalize_merchant
from engine.risk.types import ClaimLite

T = datetime(2026, 11, 3, 21, tzinfo=timezone.utc)


def c(rid, merchant, amount, user="u1", day=date(2026, 11, 3), created=T, status="REVIEW"):
    return ClaimLite(reim_id=rid, user_id=user, merchant=merchant, expense_date=day,
                     amount=amount, created_at=created, status=status)


def test_merchant_normalisation():
    assert normalize_merchant("NASI KANDAR PELITA SDN BHD") == normalize_merchant("Restoran Nasi Kandar Pelita")
    assert normalize_merchant("  The Coffee Bean, Sdn. Bhd. ") == "coffee bean"


def test_split_detected():
    s = detect_split(c("b", "Restoran Nasi Kandar Pelita", 90), [c("a", "NASI KANDAR PELITA SDN BHD", 90)], 100)
    assert s.code.value == "SPLIT_CLAIM" and s.severity.value == "MEDIUM"
    assert s.evidence["combined"] == 180 and s.evidence["related"] == ["a"]


def test_single_claim_is_not_split():
    assert detect_split(c("b", "Pelita", 90), [], 100) is None


def test_claim_does_not_count_against_itself():
    assert detect_split(c("b", "Pelita", 90), [c("b", "Pelita", 90)], 100) is None


def test_split_needs_same_user_merchant_and_date():
    claim = c("b", "Pelita", 90)
    assert detect_split(claim, [c("a", "Pelita", 90, user="u2")], 100) is None
    assert detect_split(claim, [c("a", "Mamak Corner", 90)], 100) is None
    assert detect_split(claim, [c("a", "Pelita", 90, day=date(2026, 11, 2))], 100) is None
    assert detect_split(c("b", "Pelita", 90, day=None), [c("a", "Pelita", 90, day=None)], 100) is None


def test_split_window_is_48_hours():
    claim = c("b", "Pelita", 90)
    assert detect_split(claim, [c("a", "Pelita", 90, created=T - timedelta(hours=47))], 100) is not None
    assert detect_split(claim, [c("a", "Pelita", 90, created=T - timedelta(hours=49))], 100) is None


def test_split_ignores_claims_over_the_limit_and_sums_under_it():
    claim = c("b", "Pelita", 90)
    assert detect_split(claim, [c("a", "Pelita", 150)], 100) is None
    assert detect_split(c("b", "Pelita", 40), [c("a", "Pelita", 50)], 100) is None


def test_rejected_claim_resubmitted_is_not_a_split():
    assert detect_split(c("b", "Pelita", 90), [c("a", "Pelita", 90, status="REJECTED")], 100) is None


def test_near_threshold_low_then_medium():
    assert detect_near_threshold(95, 100, []).severity.value == "LOW"
    assert detect_near_threshold(95, 100, [92, 97]).severity.value == "MEDIUM"
    assert detect_near_threshold(80, 100, [92, 97]) is None


def test_near_threshold_band_edges():
    assert detect_near_threshold(90, 100, []) is not None
    assert detect_near_threshold(100, 100, []) is not None
    assert detect_near_threshold(100.01, 100, []) is None
    assert detect_near_threshold(95, 100, [92, 50, 101]).severity.value == "LOW"
