"""
Tamper-evident agent action log.

Each `agent_actions` row stores `hash = sha256(prev_hash + row)`, so editing or deleting any
row breaks every hash after it. `verify_chain` recomputes the chain for the HR UI.
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session, select

from core.enums import AgentActionType
from core.models import AgentAction

logger = logging.getLogger(__name__)

GENESIS_HASH = "0" * 64
# Serialises writers so two actions logged at once can't both chain off the same row.
ADVISORY_LOCK_KEY = 724242


def compute_hash(
    prev_hash: str,
    action_type: str,
    actor: str,
    reim_id: str | None,
    payload: dict,
    created_at: datetime,
) -> str:
    # Normalised to UTC so the hash doesn't depend on the DB session time zone.
    ts = created_at.astimezone(timezone.utc).isoformat()
    body = json.dumps(
        [prev_hash, action_type, actor, reim_id, payload, ts],
        sort_keys=True, separators=(",", ":"), default=str,
    )
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _row_hash(row: dict) -> str:
    action_type = row["action_type"]
    if isinstance(action_type, AgentActionType):
        action_type = action_type.value
    reim_id = row.get("reim_id")
    return compute_hash(
        row["prev_hash"], action_type, row["actor"],
        str(reim_id) if reim_id is not None else None,
        row.get("payload") or {}, row["created_at"],
    )


def verify_rows(rows: list[dict]) -> bool:
    """Rows must be in insertion order (ascending action_id)."""
    expected_prev = GENESIS_HASH
    for row in rows:
        if row["prev_hash"] != expected_prev or row["hash"] != _row_hash(row):
            return False
        expected_prev = row["hash"]
    return True


def _json_safe(payload: dict) -> dict:
    # Stored JSONB must equal what was hashed, so Decimal/UUID/datetime become strings first.
    return json.loads(json.dumps(payload or {}, default=str))


def record_action(
    db: Session,
    action_type: AgentActionType,
    actor: str,
    reim_id: UUID | None,
    payload: dict,
) -> AgentAction:
    """Append one action and commit. Commits any pending changes in `db` as well."""
    action_type = AgentActionType(action_type)
    db.exec(text(f"SELECT pg_advisory_xact_lock({ADVISORY_LOCK_KEY})"))
    last = db.exec(select(AgentAction).order_by(AgentAction.action_id.desc()).limit(1)).first()
    prev_hash = last.hash if last else GENESIS_HASH
    created_at = datetime.now(timezone.utc)
    clean = _json_safe(payload)
    reim_str = str(reim_id) if reim_id is not None else None
    action = AgentAction(
        action_type=action_type.value,
        actor=str(actor),
        reim_id=UUID(reim_str) if reim_str else None,
        payload=clean,
        prev_hash=prev_hash,
        hash=compute_hash(prev_hash, action_type.value, str(actor), reim_str, clean, created_at),
        created_at=created_at,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    logger.info("[AGENT_ACTION] #%s %s actor=%s reim=%s", action.action_id, action_type.value, actor, reim_id)
    return action


def action_to_dict(a: AgentAction) -> dict:
    return {
        "action_id": a.action_id,
        "action_type": a.action_type.value if isinstance(a.action_type, AgentActionType) else a.action_type,
        "actor": a.actor,
        "reim_id": str(a.reim_id) if a.reim_id else None,
        "payload": a.payload or {},
        "prev_hash": a.prev_hash,
        "hash": a.hash,
        "created_at": a.created_at,
    }


def verify_chain(db: Session) -> bool:
    rows = db.exec(select(AgentAction).order_by(AgentAction.action_id)).all()
    return verify_rows([action_to_dict(a) for a in rows])
