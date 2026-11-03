"""
Agent action log.

Stub until Chingiz B's DB-2 lands: actions go to the application log only.
The hash-chained `agent_actions` table and `verify_chain` replace this.
"""
import logging
from uuid import UUID

from sqlmodel import Session

from core.enums import AgentActionType

logger = logging.getLogger(__name__)


def record_action(db: Session, action_type: AgentActionType, actor: str, reim_id: UUID | None, payload: dict):
    logger.info("[AGENT_ACTION] %s actor=%s reim=%s payload=%s", action_type.value, actor, reim_id, payload)
    return None
