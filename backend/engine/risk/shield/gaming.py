import re
from datetime import timedelta

from engine.risk.types import ClaimLite, RiskSignal, Severity, SignalCode, make_signal

_STOP_TOKENS = {"sdn", "bhd", "restoran", "restaurant", "the"}
_PUNCTUATION = re.compile(r"[^\w\s]")

SPLIT_WINDOW = timedelta(hours=48)
NEAR_THRESHOLD_FLOOR = 0.9
NEAR_THRESHOLD_REPEATS = 2

# A rejected claim that is fixed and resubmitted is a correction, not a split.
_IGNORED_STATUSES = {"REJECTED"}


def normalize_merchant(name: str) -> str:
    tokens = _PUNCTUATION.sub(" ", name.lower()).split()
    return " ".join(t for t in tokens if t not in _STOP_TOKENS)


def detect_split(claim: ClaimLite, recent: list[ClaimLite], limit: float) -> RiskSignal | None:
    merchant = normalize_merchant(claim.merchant)
    if not merchant or claim.expense_date is None or claim.amount > limit:
        return None
    related = [
        other
        for other in recent
        if other.reim_id != claim.reim_id
        and other.status not in _IGNORED_STATUSES
        and other.user_id == claim.user_id
        and other.expense_date == claim.expense_date
        and normalize_merchant(other.merchant) == merchant
        and abs(other.created_at - claim.created_at) <= SPLIT_WINDOW
        and other.amount <= limit
    ]
    combined = claim.amount + sum(o.amount for o in related)
    if not related or combined <= limit:
        return None
    return make_signal(
        SignalCode.SPLIT_CLAIM,
        Severity.MEDIUM,
        f"{len(related) + 1} claims from the same employee at {claim.merchant} on {claim.expense_date.isoformat()} "
        f"total {combined:,.2f}. Each is under the {limit:,.2f} auto-pay limit; together they are over it.",
        {"combined": combined, "limit": limit, "related": [o.reim_id for o in related]},
    )


def detect_near_threshold(amount: float, limit: float, recent_amounts_30d: list[float]) -> RiskSignal | None:
    """`recent_amounts_30d` should not include this claim; the spec counts the 2+ other claims in the band."""
    if limit <= 0:
        return None
    floor = NEAR_THRESHOLD_FLOOR * limit
    if not floor <= amount <= limit:
        return None
    others = sum(1 for a in recent_amounts_30d if floor <= a <= limit)
    severity = Severity.MEDIUM if others >= NEAR_THRESHOLD_REPEATS else Severity.LOW
    message = f"Amount {amount:,.2f} is just under the {limit:,.2f} auto-pay limit."
    if others:
        message += f" {others} other claim{'s' if others > 1 else ''} in the last 30 days landed in the same range."
    return make_signal(
        SignalCode.NEAR_THRESHOLD,
        severity,
        message,
        {"amount": amount, "band": [round(floor, 2), limit], "others_in_band_30d": others},
    )
