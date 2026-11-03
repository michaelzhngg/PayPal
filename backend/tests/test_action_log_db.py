from decimal import Decimal
from uuid import uuid4

from sqlalchemy import text
from sqlmodel import select

from core.enums import AgentActionType
from core.models import AgentAction
from engine.services.action_log import GENESIS_HASH, record_action, verify_chain


def _clear(db):
    db.exec(text("DELETE FROM agent_actions"))


def test_record_action_chains_rows_and_verifies(pg_db):
    _clear(pg_db)
    reim = uuid4()
    a = record_action(pg_db, AgentActionType.DECISION, "agent", reim, {"tier": "AUTO_PAY", "amount": Decimal("40.00")})
    b = record_action(pg_db, AgentActionType.PAYOUT_CREATED, "agent", reim, {"batch_id": "B1"})
    assert a.prev_hash == GENESIS_HASH and b.prev_hash == a.hash
    assert a.payload == {"tier": "AUTO_PAY", "amount": "40.00"}
    assert verify_chain(pg_db) is True


def test_verify_chain_detects_tampered_payload(pg_db):
    _clear(pg_db)
    record_action(pg_db, AgentActionType.CONFIG_CHANGED, str(uuid4()), None, {"old": 100, "new": 150})
    record_action(pg_db, AgentActionType.KILL_SWITCH, str(uuid4()), None, {"enabled": False})
    first = pg_db.exec(select(AgentAction).order_by(AgentAction.action_id)).first()
    pg_db.exec(text("UPDATE agent_actions SET payload = '{\"old\": 100, \"new\": 999}' WHERE action_id = :i").bindparams(i=first.action_id))
    pg_db.expire_all()
    assert verify_chain(pg_db) is False
