from decimal import Decimal

from engine.services.payout_service import payout_plan


def test_creates_first_attempt():
    assert payout_plan("APPROVED", Decimal("48.00"), [], True) == ("CREATE", Decimal("48.00"), 1)


def test_existing_live_payout_blocks_new_one():
    assert payout_plan("APPROVED", Decimal("48.00"), ["REQUESTED"], True)[0] == "SKIP_EXISTING"
    assert payout_plan("APPROVED", Decimal("48.00"), ["SUCCEEDED"], True)[0] == "SKIP_EXISTING"
    assert payout_plan("APPROVED", Decimal("48.00"), ["FAILED", "ACCEPTED"], True)[0] == "SKIP_EXISTING"


def test_retry_after_failure_uses_next_attempt():
    assert payout_plan("APPROVED", Decimal("48.00"), ["FAILED", "REVERSED"], True) == ("CREATE", Decimal("48.00"), 3)


def test_hr_retry_from_disbursement_failed():
    assert payout_plan("DISBURSEMENT_FAILED", Decimal("48.00"), ["FAILED"], True) == ("CREATE", Decimal("48.00"), 2)


def test_skips():
    assert payout_plan("REVIEW", Decimal("48"), [], True)[0] == "SKIP_NOT_APPROVED"
    assert payout_plan("APPROVED", Decimal("48"), [], False)[0] == "SKIP_NO_PAYEE"
    assert payout_plan("APPROVED", Decimal("0.00"), [], True)[0] == "SKIP_ZERO"
