import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote, urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlmodel import Session, select

from api import deps
from core.config import settings
from core.enums import AgentActionType
from core.models import User
from engine.services.action_log import record_action
from engine.services.payout_service import notify
from engine.services.paypal_client import PayPalError, PayPalUser, get_paypal_client, mask_email  # noqa: F401
from engine.services.payout_status import apply_item_update, next_status, reim_status_for  # noqa: F401
from engine.services.recovery_service import mark_recovered

router = APIRouter()
logger = logging.getLogger(__name__)

# Mirrors AutonomyConfig.payee_cooldown_hours until the autonomy store exists.
PAYEE_COOLDOWN_HOURS = 72
_STATE_TTL = timedelta(minutes=10)
_STATE_PURPOSE = "paypal_link"
_SCOPE = "openid email https://uri.paypal.com/services/paypalattributes"


def make_state(user_id: UUID, secret: str, now: datetime) -> str:
    claims = {"sub": str(user_id), "purpose": _STATE_PURPOSE, "exp": int((now + _STATE_TTL).timestamp())}
    return jwt.encode(claims, secret, algorithm="HS256")


def read_state(token: str, secret: str, now: datetime) -> UUID:
    try:
        # Expiry is checked against `now` below so tests and callers control the clock.
        claims = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_exp": False})
    except JWTError as e:
        raise ValueError("invalid state") from e
    if claims.get("purpose") != _STATE_PURPOSE:
        raise ValueError("wrong state purpose")
    if int(claims.get("exp", 0)) < now.timestamp():
        raise ValueError("state expired")
    try:
        return UUID(claims["sub"])
    except (KeyError, ValueError) as e:
        raise ValueError("invalid state subject") from e


def link_update(current_payer_id: str | None, ever_linked: bool, user: PayPalUser, now: datetime) -> dict:
    update = {
        "paypal_payer_id": user.payer_id,
        "paypal_email": user.email,
        "paypal_verified": user.verified,
        "paypal_linked_at": now,
    }
    if current_payer_id == user.payer_id:
        return update
    # Any change after the first link (including unlink, then link another account) pauses auto-pay.
    update["payout_destination_changed_at"] = now if ever_linked else None
    return update


def cooldown_until(changed_at: datetime | None, hours: int) -> datetime | None:
    return changed_at + timedelta(hours=hours) if changed_at else None


def build_connect_url(web_url: str, client_id: str, redirect_uri: str, state: str) -> str:
    query = urlencode({
        "flowEntry": "static",
        "client_id": client_id,
        "response_type": "code",
        "scope": _SCOPE,
        "redirect_uri": redirect_uri,
        "state": state,
    }, quote_via=quote)
    return f"{web_url.rstrip('/')}/connect?{query}"


def _callback_url() -> str:
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}{settings.API_V1_STR}/paypal/callback"


def _settings_redirect(result: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/employee/settings?paypal={result}",
                            status_code=302)


class PayPalStatus(BaseModel):
    linked: bool
    email_masked: Optional[str] = None
    verified: bool
    linked_at: Optional[datetime] = None
    cooldown_until: Optional[datetime] = None


@router.get("/connect-url")
def get_connect_url(current_user: User = Depends(deps.get_current_user)):
    state = make_state(current_user.user_id, settings.SECRET_KEY, datetime.now(timezone.utc))
    if settings.PAYPAL_MOCK_MODE:
        # No PayPal login page in mock mode: go straight to our callback with a fake code.
        code = f"mock-{current_user.user_id.hex[:8]}"
        return {"url": f"{_callback_url()}?{urlencode({'code': code, 'state': state})}"}
    return {"url": build_connect_url(settings.PAYPAL_WEB_URL, settings.PAYPAL_CLIENT_ID, _callback_url(), state)}


@router.get("/callback")
async def paypal_callback(
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(deps.get_db),
):
    now = datetime.now(timezone.utc)
    try:
        user_id = read_state(state or "", settings.SECRET_KEY, now)
    except ValueError:
        logger.warning("[PAYPAL_LINK] Rejected callback with invalid or expired state")
        return _settings_redirect("error")

    employee = db.get(User, user_id)
    if not employee or not code:
        return _settings_redirect("error")

    client = get_paypal_client()
    try:
        paypal_user = await client.get_userinfo(await client.exchange_auth_code(code))
    except PayPalError:
        logger.exception("[PAYPAL_LINK] Code exchange or userinfo failed for user=%s", user_id)
        return _settings_redirect("error")
    if not paypal_user.payer_id:
        return _settings_redirect("error")

    taken = db.exec(
        select(User).where(User.paypal_payer_id == paypal_user.payer_id, User.user_id != user_id)
    ).first()
    if taken:
        logger.warning("[PAYPAL_LINK] Payer already linked to another employee; user=%s", user_id)
        return _settings_redirect("error")

    update = link_update(employee.paypal_payer_id, employee.paypal_linked_at is not None, paypal_user, now)
    for field, value in update.items():
        setattr(employee, field, value)
    db.add(employee)
    db.commit()

    changed = update.get("payout_destination_changed_at") is not None
    record_action(db, AgentActionType.PAYEE_LINKED, str(user_id), None, {
        "email": mask_email(paypal_user.email or ""),
        "verified": paypal_user.verified,
        "changed": changed,
    })
    if changed:
        until = cooldown_until(now, PAYEE_COOLDOWN_HOURS)
        notify(
            db, user_id, "warning", "Your payout account changed",
            f"Your payout account changed. Instant payouts are paused until {until:%d %b %Y %H:%M} UTC. "
            "If this wasn't you, contact HR.",
            link="/employee/settings",
        )
    return _settings_redirect("linked")


@router.get("/status", response_model=PayPalStatus)
def paypal_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    employee = db.get(User, current_user.user_id)
    until = cooldown_until(employee.payout_destination_changed_at, PAYEE_COOLDOWN_HOURS)
    if until and until <= datetime.now(timezone.utc):
        until = None
    return PayPalStatus(
        linked=bool(employee.paypal_payer_id),
        email_masked=mask_email(employee.paypal_email) if employee.paypal_email else None,
        verified=bool(employee.paypal_payer_id and employee.paypal_verified),
        linked_at=employee.paypal_linked_at,
        cooldown_until=until,
    )


@router.delete("/link", status_code=204)
def unlink_paypal(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    employee = db.get(User, current_user.user_id)
    # paypal_linked_at is kept so that linking a different account later still counts as a change.
    employee.paypal_payer_id = None
    employee.paypal_email = None
    employee.paypal_verified = False
    db.add(employee)
    db.commit()
    return Response(status_code=204)


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
