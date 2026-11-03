"""
Overpayment recovery.

Stub until Chingiz B's Task 5: no offsets are applied and invoices are not tracked.
"""
import logging
from decimal import Decimal
from uuid import UUID

from sqlmodel import Session

from core.models import Reimbursement

logger = logging.getLogger(__name__)


def offset_for_reim(db: Session, reim: Reimbursement) -> tuple[Decimal, list[UUID]]:
    return Decimal(str(reim.total_approved_amount or 0)), []


def mark_recovered(db: Session, paypal_invoice_id: str) -> None:
    logger.info("[RECOVERY] Invoice %s paid (recovery tracking not implemented yet)", paypal_invoice_id)
