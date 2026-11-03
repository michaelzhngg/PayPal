import pytest

from engine.risk.shield.arithmetic import check_totals


def test_consistent_totals_pass():
    assert check_totals([10.0, 20.0], 2.4, None, 32.4) is None
    assert check_totals([10.0, 20.0], 2.4, None, 32.43) is None
    assert check_totals([10.0, 20.0], 2.4, 3.0, 35.4) is None


def test_inflated_total_flagged_medium():
    s = check_totals([10.0, 20.0], 2.4, None, 324.0, "doc1")
    assert s.code.value == "ARITHMETIC_MISMATCH" and s.severity.value == "MEDIUM" and s.points == 20
    assert s.evidence["expected_total"] == pytest.approx(32.4) and s.document_id == "doc1"


def test_tolerance_is_two_percent_of_total():
    # 2% of 500 is 10, so a 9.00 gap passes and an 11.00 gap does not.
    assert check_totals([491.0], None, None, 500.0) is None
    assert check_totals([489.0], None, None, 500.0) is not None


def test_tolerance_floor_is_five_cents():
    assert check_totals([1.0], None, None, 1.05) is None
    assert check_totals([1.0], None, None, 1.07) is not None


def test_no_items_skips():
    assert check_totals([], None, None, 50.0) is None


def test_message_does_not_accuse():
    s = check_totals([10.0], None, None, 100.0)
    assert "misread" in s.message.lower()
