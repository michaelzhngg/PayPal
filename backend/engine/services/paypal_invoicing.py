"""
PayPal invoices for overpayment recovery, sent through the PayPal Agent Toolkit.

The toolkit's `create_invoice` tool validates against a model without `reference`, `note` or
`invoice_number`, and then sends with its own canned note. So the create call posts our full
payload through the toolkit's client, and the send goes through the toolkit's `send_invoice` tool.
If the toolkit can't be imported, the REST fallback posts the same two calls through `PayPalClient`.

Nothing here decides whether to invoice. Only `POST /recoveries/{id}/execute`, called by HR, gets here.
"""
import asyncio
import hashlib
import json
import logging
from decimal import Decimal

from core.config import settings
from engine.services.paypal_client import PayPalError, format_amount, get_paypal_client

logger = logging.getLogger(__name__)

INVOICES_PATH = "/v2/invoicing/invoices"
EMAIL_SUBJECT = "Reclaim Pay: overpayment invoice"


def build_invoice_payload(recipient_email: str, amount: Decimal, currency: str, note: str, reference: str,
                          invoice_number: str | None = None) -> dict:
    detail = {
        "currency_code": currency,
        "reference": reference,
        "note": note,
    }
    if invoice_number:
        # PayPal refuses a reused invoice number, so a repeated execute can't bill twice.
        detail["invoice_number"] = invoice_number
    return {
        "detail": detail,
        "primary_recipients": [{"billing_info": {"email_address": recipient_email}}],
        "items": [{
            "name": f"Overpayment on claim {reference}",
            "quantity": "1",
            "unit_amount": {"currency_code": currency, "value": format_amount(amount)},
            "unit_of_measure": "AMOUNT",
        }],
    }


def _send_body(payload: dict) -> dict:
    return {
        "subject": EMAIL_SUBJECT,
        "note": payload["detail"].get("note"),
        "send_to_recipient": True,
        "send_to_invoicer": False,
    }


def invoice_id_from_response(data: dict) -> str:
    """Create returns the invoice itself or, by default, a link whose last segment is the ID."""
    if data.get("id"):
        return data["id"]
    href = data.get("href") or ""
    if "/v2/invoicing/invoices/" in href:
        return href.rstrip("/").split("/")[-1]
    raise PayPalError(502, "INVOICE_ID_MISSING", message=json.dumps(data)[:200])


def mock_invoice_id(payload: dict) -> str:
    seed = payload["detail"].get("invoice_number") or json.dumps(payload, sort_keys=True)
    digest = hashlib.sha256(seed.encode()).hexdigest().upper()
    return "INV2-" + "-".join(digest[i:i + 4] for i in range(0, 16, 4))


def _toolkit_create_and_send(payload: dict) -> str:
    import requests
    from paypal_agent_toolkit.shared.configuration import Context
    from paypal_agent_toolkit.shared.invoices.tool_handlers import send_invoice
    from paypal_agent_toolkit.shared.paypal_client import PayPalClient as ToolkitClient

    client = ToolkitClient(
        client_id=settings.PAYPAL_CLIENT_ID,
        secret=settings.PAYPAL_CLIENT_SECRET,
        context=Context(sandbox="sandbox" in settings.PAYPAL_BASE_URL),
    )
    try:
        invoice_id = invoice_id_from_response(client.post(uri=INVOICES_PATH, payload=payload))
    except requests.HTTPError as exc:
        raise PayPalError(exc.response.status_code if exc.response is not None else 502, "INVOICE_CREATE_FAILED",
                          message=str(exc)) from exc
    try:
        send_invoice(client, {"invoice_id": invoice_id, **_send_body(payload)})
    except requests.HTTPError as exc:
        # The draft exists in PayPal but was never sent; HR can send it from the PayPal dashboard.
        logger.error("[INVOICE] Created %s but sending failed: %s", invoice_id, exc)
        raise PayPalError(exc.response.status_code if exc.response is not None else 502, "INVOICE_SEND_FAILED",
                          message=f"draft {invoice_id} created but not sent") from exc
    return invoice_id


async def _rest_create_and_send(payload: dict) -> str:
    client = get_paypal_client()
    invoice_id = invoice_id_from_response(await client.request("POST", INVOICES_PATH, json=payload))
    await client.request("POST", f"{INVOICES_PATH}/{invoice_id}/send", json=_send_body(payload))
    return invoice_id


def _toolkit_available() -> bool:
    try:
        import paypal_agent_toolkit.shared.invoices.tool_handlers  # noqa: F401
    except ImportError:
        return False
    return True


async def create_and_send_invoice(payload: dict) -> str:
    """Create and send one invoice; returns PayPal's invoice ID. Raises PayPalError on failure."""
    if settings.PAYPAL_MOCK_MODE:
        invoice_id = mock_invoice_id(payload)
        logger.info("[INVOICE] Mock invoice %s for %s", invoice_id, payload["detail"].get("reference"))
        return invoice_id
    if _toolkit_available():
        # The toolkit uses blocking `requests`, so keep it off the event loop.
        return await asyncio.to_thread(_toolkit_create_and_send, payload)
    logger.warning("[INVOICE] paypal-agent-toolkit not importable, using the REST invoice path")
    return await _rest_create_and_send(payload)
