import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from api import deps
from api.schemas import CreatePayoutRequest
from core.models import User, Reimbursement, Payout
from core.enums import UserRole, PayoutStatus
from engine.services.payout_service import initiate_payout_async, payout_plan
from engine.services.payout_status import FINAL_STATUSES, refresh_payout
from engine.services.paypal_client import PayPalError
from engine.services.recovery_service import offset_for_reim

router = APIRouter()
logger = logging.getLogger(__name__)

_REFRESH_AFTER = timedelta(seconds=10)


class PayoutOut(BaseModel):
    payout_id: UUID
    reim_id: UUID
    user_id: UUID
    amount: float
    currency: str
    status: PayoutStatus
    provider: str
    provider_batch_id: Optional[str] = None
    provider_item_id: Optional[str] = None
    attempt: int
    xendit_id: Optional[str] = None
    reference_id: str
    channel_code: str
    failure_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


_SKIP_DETAIL = {
    "SKIP_NOT_APPROVED": "Claim must be APPROVED (or DISBURSEMENT_FAILED for a retry) before it can be paid.",
    "SKIP_EXISTING": "A payout for this claim is already in progress or has succeeded.",
    "SKIP_NO_PAYEE": "Employee has not connected a verified PayPal account. Ask them to connect PayPal in Settings.",
}


@router.post("/", response_model=PayoutOut)
async def create_payout(
    body: CreatePayoutRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_hr_user),
):
    reim = db.get(Reimbursement, body.reim_id)
    if not reim:
        raise HTTPException(status_code=404, detail="Reimbursement not found")

    employee = db.get(User, reim.user_id)
    existing = db.exec(select(Payout).where(Payout.reim_id == body.reim_id)).all()
    net_amount, _ = offset_for_reim(db, reim)
    action, _, _ = payout_plan(
        reim.status, net_amount, [p.status for p in existing],
        bool(employee and employee.paypal_verified and employee.paypal_payer_id),
    )
    if action in _SKIP_DETAIL:
        raise HTTPException(status_code=400, detail=_SKIP_DETAIL[action])
    if action == "SKIP_ZERO":
        await initiate_payout_async(body.reim_id, db)
        raise HTTPException(status_code=400, detail="Nothing to pay: the claim was settled against an earlier overpayment.")

    payout = await initiate_payout_async(body.reim_id, db)
    if payout is None:
        raise HTTPException(status_code=502, detail="PayPal did not accept the payout. Try again shortly.")
    return PayoutOut.model_validate(payout)


@router.get("/{reim_id}", response_model=PayoutOut)
async def get_payout(
    reim_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    try:
        reim_uuid = UUID(reim_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reim_id")

    reim = db.get(Reimbursement, reim_uuid)
    if not reim:
        raise HTTPException(status_code=404, detail="Reimbursement not found")

    if current_user.role != UserRole.HR and reim.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    payout = db.exec(
        select(Payout).where(Payout.reim_id == reim_uuid).order_by(Payout.attempt.desc())
    ).first()
    if not payout:
        raise HTTPException(status_code=404, detail="No payout found for this claim")

    stale = payout.updated_at is None or datetime.now(timezone.utc) - payout.updated_at > _REFRESH_AFTER
    if payout.provider == "PAYPAL" and PayoutStatus(payout.status) not in FINAL_STATUSES and stale:
        try:
            payout = await refresh_payout(db, payout)
        except PayPalError:
            # A PayPal outage must not break the claim page: show the last known status.
            logger.warning("[PAYOUT] Status refresh failed for reim=%s; returning stored status", reim_uuid)
            db.rollback()

    return PayoutOut.model_validate(payout)
