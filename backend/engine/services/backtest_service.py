"""Autonomy Dial back-test and the employee trust card.

The back-test re-runs decide() over past claims with a candidate config. It makes no LLM calls:
signals come from each claim's stored decision.
"""
import logging
from datetime import datetime, timedelta
from uuid import UUID

from pydantic import BaseModel, ValidationError
from sqlmodel import Session, select

from core.enums import ReimbursementStatus
from core.models import Recovery, Reimbursement
from engine.risk.autonomy import decide, limit_for, trust_tier
from engine.risk.types import (
    AgentLedger,
    AutonomyConfig,
    AutonomyTier,
    ClaimFacts,
    EmployeeHistory,
    HardStop,
    PayeeStatus,
    RiskSignal,
    TrustTier,
)
from engine.services import autonomy_store as store

logger = logging.getLogger(__name__)

CURVE_LIMITS = (25, 50, 75, 100, 150, 200, 300, 500)
ASSUMPTIONS = ["ignores daily budget and circuit breaker", "ignores the kill switch"]
# Claims whose outcome is known: paid out, on the way, or rejected by HR.
DECIDED_STATUSES = {
    ReimbursementStatus.APPROVED.value,
    ReimbursementStatus.DISBURSING.value,
    ReimbursementStatus.PAID.value,
    ReimbursementStatus.DISBURSEMENT_FAILED.value,
    ReimbursementStatus.REJECTED.value,
}
STANDARD_MIN_PAID = 3
TRUSTED_MIN_PAID = 10
NEW_ISSUE_DAYS = 90
TRUSTED_ISSUE_DAYS = 180
NO_LEDGER = AgentLedger(auto_paid_today=0, auto_paid_last_hour=0, breaker_active=False)


class BacktestCase(BaseModel):
    claim: ClaimFacts
    signals: list[RiskSignal]
    history: EmployeeHistory
    payee: PayeeStatus
    bad: bool


class CurvePoint(BaseModel):
    auto_limit_standard: float
    automation_rate: float
    projected_leakage: float


class BacktestResult(BaseModel):
    total_claims: int
    auto_paid_count: int
    automation_rate: float
    auto_paid_amount: float
    bad_auto_paid_count: int
    projected_leakage: float
    caught_bad_count: int
    hr_reviews_avoided: int
    hr_hours_saved: float
    by_tier: dict[str, int]
    curve: list[CurvePoint]
    assumptions: list[str]


def _tiers(cases: list[BacktestCase], config: AutonomyConfig, now: datetime) -> list[AutonomyTier]:
    return [decide(c.claim, c.signals, c.history, c.payee, NO_LEDGER, config, now).tier for c in cases]


def _leakage(cases: list[BacktestCase], tiers: list[AutonomyTier], config: AutonomyConfig) -> float:
    lost = sum(c.claim.amount for c, t in zip(cases, tiers) if c.bad and t == AutonomyTier.AUTO_PAY)
    return round(lost * (1 - config.recovery_rate), 2)


def _rate(tiers: list[AutonomyTier]) -> float:
    if not tiers:
        return 0.0
    return round(sum(1 for t in tiers if t == AutonomyTier.AUTO_PAY) / len(tiers), 3)


def run_backtest(cases: list[BacktestCase], config: AutonomyConfig, now: datetime) -> BacktestResult:
    config = config.model_copy(update={"enabled": True})
    tiers = _tiers(cases, config, now)
    auto = [c for c, t in zip(cases, tiers) if t == AutonomyTier.AUTO_PAY]
    by_tier = {t.value: 0 for t in AutonomyTier}
    for t in tiers:
        by_tier[t.value] += 1

    curve = []
    for limit in CURVE_LIMITS:
        point_cfg = config.model_copy(update={
            "auto_limit_new": limit / 2, "auto_limit_standard": float(limit), "auto_limit_trusted": limit * 2.0,
        })
        point_tiers = _tiers(cases, point_cfg, now)
        curve.append(CurvePoint(auto_limit_standard=limit, automation_rate=_rate(point_tiers),
                                projected_leakage=_leakage(cases, point_tiers, point_cfg)))

    return BacktestResult(
        total_claims=len(cases),
        auto_paid_count=len(auto),
        automation_rate=_rate(tiers),
        auto_paid_amount=round(sum(c.claim.amount for c in auto), 2),
        bad_auto_paid_count=sum(1 for c in auto if c.bad),
        projected_leakage=_leakage(cases, tiers, config),
        caught_bad_count=sum(1 for c, t in zip(cases, tiers) if c.bad and t != AutonomyTier.AUTO_PAY),
        hr_reviews_avoided=len(auto),
        hr_hours_saved=round(len(auto) * config.review_minutes / 60, 1),
        by_tier=by_tier,
        curve=curve,
        assumptions=list(ASSUMPTIONS),
    )


def next_tier_info(history: EmployeeHistory) -> tuple[TrustTier | None, int]:
    """The next trust tier and the paid claims still needed. 0 with a tier means only time is missing."""
    tier = trust_tier(history)
    if tier == TrustTier.TRUSTED:
        return None, 0
    if tier == TrustTier.STANDARD:
        return TrustTier.TRUSTED, max(0, TRUSTED_MIN_PAID - history.paid_claims)
    return TrustTier.STANDARD, max(0, STANDARD_MIN_PAID - history.paid_claims)


def _issue_dates_by_user(db: Session, user_ids: set[UUID]) -> dict[UUID, list[datetime]]:
    """Bulk version of autonomy_store._confirmed_issue_dates."""
    dates: dict[UUID, list[datetime]] = {u: [] for u in user_ids}
    recoveries = db.exec(
        select(Recovery.user_id, Recovery.created_at).where(
            Recovery.user_id.in_(user_ids), Recovery.status.in_(store.CONFIRMED_RECOVERY_STATUSES)
        )
    ).all()
    for user_id, created in recoveries:
        if created:
            dates[user_id].append(created)
    rejected = db.exec(
        select(Reimbursement).where(
            Reimbursement.user_id.in_(user_ids),
            Reimbursement.status == ReimbursementStatus.REJECTED.value,
            Reimbursement.reviewed_by.is_not(None),
        )
    ).all()
    for r in rejected:
        at = r.reviewed_at or r.updated_at
        if at and store._has_high_signal(r.autonomy):
            dates[r.user_id].append(at)
    return dates


def _case(r: Reimbursement, rows: list[tuple[datetime, dict]], issues: list[datetime],
          bad: bool, now: datetime) -> BacktestCase:
    at = store._utc(r.created_at)
    stored = r.autonomy or {}
    stops = set(stored.get("hard_stops") or [])
    # Only the claim's own data and the employee's record before it, as decide() saw them then.
    history = store.history_from_rows(
        [row for updated, row in rows if updated < at],
        [d for d in issues if store._utc(d) < at],
        at,
    )
    # Payee history isn't stored; the stored stops say whether the payee was usable at the time.
    payee = PayeeStatus(
        verified=HardStop.PAYEE_NOT_VERIFIED.value not in stops,
        linked_at=None,
        changed_at=now if HardStop.PAYEE_COOLDOWN.value in stops else None,
    )
    judgment = r.judgment.value if hasattr(r.judgment, "value") else str(r.judgment)
    claim = ClaimFacts(
        reim_id=str(r.reim_id), user_id=str(r.user_id), amount=float(r.total_claimed_amount or 0),
        currency=r.currency or "MYR", judgment=judgment, confidence=r.confidence or 0.0,
        over_category_budget=HardStop.OVER_CATEGORY_BUDGET.value in stops,
        claimant_is_hr=HardStop.HR_SELF_CLAIM.value in stops,
    )
    signals = [RiskSignal.model_validate(s) for s in stored.get("signals") or []]
    return BacktestCase(claim=claim, signals=signals, history=history, payee=payee, bad=bad)


def load_backtest_cases(db: Session, now: datetime, days: int = 90) -> list[BacktestCase]:
    """Decided claims from the last `days` days that carry a stored autonomy decision, oldest first."""
    since = store._utc(now) - timedelta(days=days)
    claims = db.exec(
        select(Reimbursement)
        .where(
            Reimbursement.created_at >= since,
            Reimbursement.autonomy.is_not(None),
            Reimbursement.status.in_(DECIDED_STATUSES),
        )
        .order_by(Reimbursement.created_at)
    ).all()
    if not claims:
        return []
    user_ids = {r.user_id for r in claims}
    rows: dict[UUID, list[tuple[datetime, dict]]] = {u: [] for u in user_ids}
    for r in db.exec(select(Reimbursement).where(Reimbursement.user_id.in_(user_ids))).all():
        row = store._claim_row(r)
        rows[r.user_id].append((store._utc(row["updated_at"]), row))
    issues = _issue_dates_by_user(db, user_ids)
    recovered = set(db.exec(
        select(Recovery.reim_id).where(
            Recovery.reim_id.in_([r.reim_id for r in claims]), Recovery.status.in_(store.CONFIRMED_RECOVERY_STATUSES)
        )
    ).all())

    cases = []
    for r in claims:
        rejected = store._status_str(r.status) == ReimbursementStatus.REJECTED.value and r.reviewed_by is not None
        try:
            cases.append(_case(r, rows[r.user_id], issues[r.user_id], rejected or r.reim_id in recovered, now))
        except ValidationError:
            logger.warning("[BACKTEST] Skipping claim %s: stored decision doesn't parse", r.reim_id)
    return cases


def _fmt_date(d: datetime) -> str:
    return f"{d.day} {d:%b %Y}"


def employee_trust(db: Session, user_id: UUID, config: AutonomyConfig, now: datetime) -> dict:
    """Trust card data for one employee. Holds no signal, score or claim detail."""
    now = store._utc(now)
    history = store.employee_history(db, user_id, now)
    tier = trust_tier(history)
    next_tier, needed = next_tier_info(history)
    issues = [store._utc(d) for d in store._confirmed_issue_dates(db, user_id)]

    reasons: list[str] = []
    limited_until = None
    recent = [d for d in issues if d >= now - timedelta(days=NEW_ISSUE_DAYS)]
    if recent:
        limited_until = max(recent) + timedelta(days=NEW_ISSUE_DAYS)
        reasons.append("Instant payouts are limited after a recent correction. "
                       f"They return to normal on {_fmt_date(limited_until)}.")
    elif next_tier == TrustTier.TRUSTED:
        older = [d for d in issues if d >= now - timedelta(days=TRUSTED_ISSUE_DAYS)]
        if older:
            ready = max(older) + timedelta(days=TRUSTED_ISSUE_DAYS)
            reasons.append(f"Trusted needs {TRUSTED_ISSUE_DAYS} days without a correction. "
                           f"That's on {_fmt_date(ready)}.")

    return {
        "trust_tier": tier,
        "auto_limit": limit_for(config, tier),
        "paid_claims": history.paid_claims,
        "next_tier": next_tier,
        "claims_to_next_tier": needed,
        "reasons": reasons,
        "currency": config.currency,
        "next_limit": limit_for(config, next_tier) if next_tier else None,
        "limited_until": limited_until,
    }
