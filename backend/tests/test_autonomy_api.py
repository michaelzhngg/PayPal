from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from api import deps
from core.config import settings
from core.enums import UserRole
from core.models import AutonomySettings, Reimbursement, User
from engine.services import autonomy_store as store


@pytest.fixture
def client(pg_db):
    from main import app

    pg_db.exec(text("DELETE FROM agent_actions"))
    pg_db.exec(text("DELETE FROM autonomy_settings"))
    hr = User(email=f"hr-{uuid4().hex[:8]}@test.local", hashed_password="x", name="HR Test", role=UserRole.HR)
    pg_db.add(hr)
    pg_db.commit()
    pg_db.refresh(hr)
    app.dependency_overrides[deps.get_db] = lambda: pg_db
    app.dependency_overrides[deps.get_current_hr_user] = lambda: hr
    try:
        yield TestClient(app), pg_db, hr
    finally:
        app.dependency_overrides.clear()


def test_settings_created_with_spec_defaults(client):
    c, _, _ = client
    body = c.get("/api/v1/autonomy/settings").json()
    assert body["version"] == 1 and body["enabled"] is True and body["breaker_until"] is None
    assert body["config"]["auto_limit_standard"] == 100.0 and body["config"]["dispute_window_hours"] == 120


def test_put_bumps_version_and_logs_config_change(client):
    c, _, _ = client
    cfg = c.get("/api/v1/autonomy/settings").json()["config"]
    cfg.update(auto_limit_standard=150.0, enabled=False, version=99)
    body = c.put("/api/v1/autonomy/settings", json=cfg).json()
    assert body["version"] == 2 and body["config"]["auto_limit_standard"] == 150.0
    assert body["enabled"] is True  # only the kill switch changes enabled

    log = c.get("/api/v1/autonomy/actions").json()
    assert log["chain_valid"] is True
    change = log["actions"][0]
    assert change["action_type"] == "CONFIG_CHANGED"
    assert change["payload"]["old"] == {"auto_limit_standard": 100.0}
    assert change["payload"]["new"] == {"auto_limit_standard": 150.0}


def test_put_logs_reason_without_storing_it_in_config(client, pg_db):
    c, _, _ = client
    cfg = c.get("/api/v1/autonomy/settings").json()["config"]
    cfg.update(auto_limit_standard=150.0, reason="  Raising limits after the Q3 audit ")
    body = c.put("/api/v1/autonomy/settings", json=cfg).json()
    assert "reason" not in body["config"]
    pg_db.expire_all()
    assert "reason" not in pg_db.get(AutonomySettings, 1).config
    change = c.get("/api/v1/autonomy/actions?limit=1").json()["actions"][0]
    assert change["action_type"] == "CONFIG_CHANGED"
    assert change["payload"]["reason"] == "Raising limits after the Q3 audit"


@pytest.mark.parametrize("extra", [{}, {"reason": None}, {"reason": "   "}])
def test_put_reason_is_optional(client, extra):
    c, _, _ = client
    cfg = c.get("/api/v1/autonomy/settings").json()["config"]
    cfg.update(auto_limit_standard=150.0, **extra)
    assert c.put("/api/v1/autonomy/settings", json=cfg).status_code == 200
    change = c.get("/api/v1/autonomy/actions?limit=1").json()["actions"][0]
    assert "reason" not in change["payload"]


def test_put_rejects_overlong_reason(client):
    c, _, _ = client
    cfg = c.get("/api/v1/autonomy/settings").json()["config"]
    assert c.put("/api/v1/autonomy/settings", json={**cfg, "reason": "x" * 501}).status_code == 422


def test_put_rejects_invalid_config(client):
    c, _, _ = client
    assert c.put("/api/v1/autonomy/settings", json={"auto_limit_standard": "lots"}).status_code == 422


def test_kill_switch_needs_reason_and_logs(client):
    c, _, hr = client
    assert c.post("/api/v1/autonomy/kill-switch", json={"enabled": False, "reason": "  "}).status_code == 422
    body = c.post("/api/v1/autonomy/kill-switch", json={"enabled": False, "reason": "Suspicious batch"}).json()
    assert body["enabled"] is False and body["config"]["enabled"] is False
    action = c.get("/api/v1/autonomy/actions?limit=1").json()["actions"][0]
    assert action["action_type"] == "KILL_SWITCH" and action["actor"] == str(hr.user_id)
    assert action["payload"]["reason"] == "Suspicious batch"


def test_env_flag_also_disables(client, monkeypatch):
    c, db, _ = client
    monkeypatch.setattr(settings, "AUTO_REIMBURSE_ENABLED", False)
    assert c.get("/api/v1/autonomy/settings").json()["enabled"] is False
    assert store.is_enabled(db) is False and store.get_config(db).enabled is False


def test_status_counts_todays_decisions_and_auto_paid(client):
    c, db, hr = client
    db.exec(text("DELETE FROM reimbursements WHERE summary = 'autonomy-api-test'"))
    now = datetime.now(timezone.utc)
    for tier, status, amount in [("AUTO_PAY", "PAID", 40), ("AUTO_PAY", "DISBURSING", 25), ("HR_QUICK", "REVIEW", 80)]:
        db.add(Reimbursement(user_id=hr.user_id, main_category="Meals", currency="MYR",
                             total_claimed_amount=amount, total_approved_amount=amount, judgment="APPROVED",
                             summary="autonomy-api-test", status=status, tier=tier, created_at=now, updated_at=now))
    db.commit()
    body = c.get("/api/v1/autonomy/status").json()
    assert body["decisions_today_by_tier"]["AUTO_PAY"] >= 2 and body["decisions_today_by_tier"]["HR_QUICK"] >= 1
    assert set(body["decisions_today_by_tier"]) >= {"AUTO_PAY", "HR_QUICK", "HR_REVIEW", "DUAL_REVIEW"}
    assert body["auto_paid_today"] >= 65 and body["agent_daily_budget"] == 2000.0


def test_trip_breaker_sets_until_and_logs(client):
    c, db, _ = client
    now = datetime.now(timezone.utc)
    until = store.trip_breaker(db, "6 of the last 20 decisions had a HIGH signal.", now)
    assert until == now + timedelta(minutes=60)
    assert store.breaker_active(db, now) is True and store.ledger_snapshot(db, now).breaker_active is True
    assert c.get("/api/v1/autonomy/status").json()["breaker_until"] is not None
    log = c.get("/api/v1/autonomy/actions").json()
    assert log["chain_valid"] is True and log["actions"][0]["action_type"] == "BREAKER_TRIPPED"
    assert db.get(AutonomySettings, 1).breaker_until is not None
