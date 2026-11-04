import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from engine.risk.types import AutonomyConfig


def test_register_needs_an_hr_login():
    from main import app

    body = {"email": "attacker@example.com", "name": "A", "role": "HR", "password": "x"}
    assert TestClient(app).post("/api/v1/auth/register", json=body).status_code == 401


@pytest.mark.parametrize(
    "bad",
    [
        {"auto_limit_standard": -1},
        {"auto_limit_new": float("inf")},
        {"agent_daily_budget": -0.01},
        {"quick_min_score": 60, "review_min_score": 50},
        {"dual_min_score": 101},
        {"recovery_rate": 1.5},
        {"audit_sample_rate": -0.1},
        {"breaker_window": -1},
    ],
)
def test_config_rejects_out_of_range_values(bad):
    with pytest.raises(ValidationError):
        AutonomyConfig(**bad)


def test_default_config_is_valid():
    AutonomyConfig()
