"""Overpayment recoveries (DETAIL-PLAN 9.5). HR runs them; employees see and dispute only their own."""
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from api import deps
from api.schemas import RecoveryCreate, RecoveryDispute, RecoveryInvoicePreview, RecoveryResponse
from core.enums import RecoveryStatus, UserRole
from core.models import Recovery, Reimbursement, User
from engine.services import recovery_service as svc
from engine.services.paypal_client import PayPalError

logger = logging.getLogger(__name__)

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _fail(db: Session, err: svc.RecoveryError):
    db.rollback()
    raise HTTPException(status_code=err.status_code, detail=err.code)


def _get_or_404(db: Session, recovery_id: UUID) -> Recovery:
    rec = db.get(Recovery, recovery_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Recovery not found")
    return rec


@router.post("", response_model=RecoveryResponse, status_code=201)
def create_recovery(
    body: RecoveryCreate,
    db: Session = Depends(deps.get_db),
    hr: User = Depends(deps.get_current_hr_user),
):
    reim = db.get(Reimbursement, body.reim_id)
    if reim is None:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    try:
        return svc.create_recovery(db, reim, body.amount, body.reason, hr, _now())
    except svc.RecoveryError as err:
        _fail(db, err)


@router.get("", response_model=list[RecoveryResponse])
def list_recoveries(
    status: Optional[RecoveryStatus] = Query(None),
    reim_id: Optional[UUID] = Query(None),
    db: Session = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    query = select(Recovery)
    if user.role != UserRole.HR:
        query = query.where(Recovery.user_id == user.user_id)
    if status:
        query = query.where(Recovery.status == status.value)
    if reim_id:
        query = query.where(Recovery.reim_id == reim_id)
    return db.exec(query.order_by(Recovery.created_at.desc()).limit(500)).all()


@router.post("/{recovery_id}/dispute", response_model=RecoveryResponse)
def dispute_recovery(
    recovery_id: UUID,
    body: RecoveryDispute,
    db: Session = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    rec = svc.lock_recovery(db, recovery_id)
    # Someone else's recovery answers 404, so its existence isn't revealed.
    if rec is None or rec.user_id != user.user_id:
        db.rollback()
        raise HTTPException(status_code=404, detail="Recovery not found")
    try:
        return svc.dispute_recovery(db, rec, user, body.note, _now())
    except svc.RecoveryError as err:
        _fail(db, err)


@router.get("/{recovery_id}/invoice-preview", response_model=RecoveryInvoicePreview)
async def invoice_preview(
    recovery_id: UUID,
    db: Session = Depends(deps.get_db),
    hr: User = Depends(deps.get_current_hr_user),
):
    rec = _get_or_404(db, recovery_id)
    try:
        p = await svc.preview_invoice(db, rec, hr, _now())
    except svc.RecoveryError as err:
        _fail(db, err)
    return RecoveryInvoicePreview(note=p.note, amount=float(p.amount), currency=p.currency,
                                  recipient_email_masked=p.recipient_email_masked, path=p.path)


@router.post("/{recovery_id}/execute", response_model=RecoveryResponse)
async def execute_recovery(
    recovery_id: UUID,
    db: Session = Depends(deps.get_db),
    hr: User = Depends(deps.get_current_hr_user),
):
    try:
        return await svc.execute_recovery(db, recovery_id, hr, _now())
    except svc.RecoveryError as err:
        _fail(db, err)
    except PayPalError as err:
        db.rollback()
        logger.error("[RECOVERY] Invoice for %s failed: %s", recovery_id, err)
        raise HTTPException(status_code=502, detail="PAYPAL_INVOICE_FAILED")


@router.post("/{recovery_id}/waive", response_model=RecoveryResponse)
def waive_recovery(
    recovery_id: UUID,
    db: Session = Depends(deps.get_db),
    hr: User = Depends(deps.get_current_hr_user),
):
    rec = svc.lock_recovery(db, recovery_id)
    if rec is None:
        db.rollback()
        raise HTTPException(status_code=404, detail="Recovery not found")
    try:
        return svc.waive_recovery(db, rec, hr, _now())
    except svc.RecoveryError as err:
        _fail(db, err)
