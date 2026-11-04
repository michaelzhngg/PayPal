from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from api.reimbursements import _check_overrides, _decided_line_item
from api.schemas import LineItemAdjustment
from core.enums import JudgmentResult


def _line(claimed=100.0, approved=0.0, judgment=JudgmentResult.REJECTED):
    return SimpleNamespace(line_item_id=uuid4(), claimed_amount=claimed, approved_amount=approved, judgment=judgment)


def test_explicit_zero_stands_when_approving():
    assert _decided_line_item(_line(), 0.0, True) == (0.0, JudgmentResult.REJECTED)


def test_partial_figure_is_paid_as_set():
    assert _decided_line_item(_line(), 40.0, True) == (40.0, JudgmentResult.APPROVED)


def test_no_figure_accepts_a_rejected_line_in_full():
    assert _decided_line_item(_line(), None, True) == (100.0, JudgmentResult.APPROVED)


def test_rejecting_the_claim_keeps_the_line_rejected():
    assert _decided_line_item(_line(), None, False) == (0.0, JudgmentResult.REJECTED)


def test_override_above_claimed_is_refused():
    line = _line()
    adjustment = SimpleNamespace(line_item_id=line.line_item_id, approved_amount=100.01)
    with pytest.raises(HTTPException) as err:
        _check_overrides([line], [adjustment])
    assert err.value.status_code == 422 and err.value.detail == "AMOUNT_ABOVE_CLAIMED"


def test_override_up_to_claimed_is_allowed():
    line = _line()
    _check_overrides([line], [SimpleNamespace(line_item_id=line.line_item_id, approved_amount=100.0)])


@pytest.mark.parametrize("bad", [-1, float("nan"), float("inf")])
def test_adjustment_rejects_bad_amounts(bad):
    with pytest.raises(ValidationError):
        LineItemAdjustment(line_item_id=uuid4(), approved_amount=bad)
