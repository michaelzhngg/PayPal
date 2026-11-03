"""HR endpoints for autonomy settings, the kill switch, today's status and the action log."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from api import deps
from core.models import AgentAction, User
from engine.services import autonomy_store as store
from engine.services.action_log import action_to_dict, verify_chain
from engine.services.risk_contract import AutonomyConfig

router = APIRouter()


class AutonomySettingsOut(BaseModel):
    config: dict[str, Any]
    enabled: bool
    version: int
    breaker_until: datetime | None


class KillSwitchIn(BaseModel):
    enabled: bool
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("reason is required")
        return v


class AutonomyStatusOut(BaseModel):
    enabled: bool
    breaker_until: datetime | None
    auto_paid_today: float
    agent_daily_budget: float
    decisions_today_by_tier: dict[str, int]


class AgentActionOut(BaseModel):
    action_id: int
    action_type: str
    actor: str
    reim_id: str | None
    payload: dict[str, Any]
    prev_hash: str
    hash: str
    created_at: datetime


class AgentActionsOut(BaseModel):
    chain_valid: bool
    actions: list[AgentActionOut]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _settings_out(db: Session) -> AutonomySettingsOut:
    row = store.settings_row(db)
    cfg = store.get_config(db)
    return AutonomySettingsOut(
        config=cfg.model_dump(mode="json"),
        enabled=cfg.enabled,
        version=row.version,
        breaker_until=store.active_breaker_until(row, _now()),
    )


@router.get("/settings", response_model=AutonomySettingsOut)
def get_settings(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_hr_user),
):
    return _settings_out(db)


@router.put("/settings", response_model=AutonomySettingsOut)
def put_settings(
    body: AutonomyConfig,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_hr_user),
):
    """`enabled` and `version` in the body are ignored: use the kill switch, and the server bumps the version."""
    store.update_config(db, body, current_user.user_id, _now())
    return _settings_out(db)


@router.post("/kill-switch", response_model=AutonomySettingsOut)
def kill_switch(
    body: KillSwitchIn,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_hr_user),
):
    store.set_enabled(db, body.enabled, body.reason, current_user.user_id, _now())
    return _settings_out(db)


@router.get("/status", response_model=AutonomyStatusOut)
def get_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_hr_user),
):
    now = _now()
    cfg = store.get_config(db)
    ledger = store.ledger_snapshot(db, now)
    return AutonomyStatusOut(
        enabled=cfg.enabled,
        breaker_until=store.active_breaker_until(store.settings_row(db), now),
        auto_paid_today=round(ledger.auto_paid_today, 2),
        agent_daily_budget=cfg.agent_daily_budget,
        decisions_today_by_tier=store.decisions_today_by_tier(db, now),
    )


@router.get("/actions", response_model=AgentActionsOut)
def get_actions(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_hr_user),
):
    rows = db.exec(select(AgentAction).order_by(AgentAction.action_id.desc()).limit(limit)).all()
    return AgentActionsOut(
        chain_valid=verify_chain(db),
        actions=[AgentActionOut(**action_to_dict(a)) for a in rows],
    )
