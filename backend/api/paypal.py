import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from api import deps
from core.config import settings
from engine.services.paypal_client import PayPalError, get_paypal_client
from engine.services.payout_status import apply_item_update, next_status, reim_status_for  # noqa: F401
from engine.services.recovery_service import mark_recovered

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/webhook")
async def paypal_webhook(request: Request, db: Session = Depends(deps.get_db)):
    """PayPal webhook receiver. Every event is verified with PayPal unless mock mode is on."""
    try:
        event = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if not settings.PAYPAL_MOCK_MODE:
        try:
            verified = await get_paypal_client().verify_webhook(request.headers, event, settings.PAYPAL_WEBHOOK_ID)
        except PayPalError:
            logger.exception("[PAYPAL_WEBHOOK] Signature verification call failed")
            verified = False
        if not verified:
            logger.warning("[PAYPAL_WEBHOOK] Rejected event id=%s: signature not verified", event.get("id"))
            raise HTTPException(status_code=400, detail="Webhook signature not verified")

    event_type = event.get("event_type", "")
    resource = event.get("resource") or {}
    logger.info("[PAYPAL_WEBHOOK] Received %s id=%s", event_type, event.get("id"))

    if event_type.startswith("PAYMENT.PAYOUTS-ITEM."):
        errors = resource.get("errors")
        apply_item_update(
            db,
            resource.get("payout_item_id"),
            (resource.get("payout_item") or {}).get("sender_item_id"),
            resource.get("transaction_status", ""),
            errors.get("name") if isinstance(errors, dict) else None,
        )
    elif event_type == "INVOICING.INVOICE.PAID":
        mark_recovered(db, resource.get("id") or (resource.get("invoice") or {}).get("id", ""))

    return {"status": "ok"}
