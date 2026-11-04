import asyncio
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
import pytest

from core.config import settings
from core.enums import RecoveryStatus
from engine.services import paypal_invoicing
from engine.services.paypal_client import PayPalClient
from engine.services.paypal_invoicing import (
    build_invoice_payload,
    create_and_send_invoice,
    invoice_id_from_response,
    mock_invoice_id,
)
from engine.services.recovery_service import (
    _clean_note,
    apply_offsets,
    choose_path,
    draft_recovery_note,
    fallback_note,
    format_deadline,
)

NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)
AMT = Decimal("30.00")
REF = "RC-1a2b3c4d"


def test_wait_inside_dispute_window():
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW + timedelta(hours=1), NOW, None, AMT) == "WAIT"


def test_disputed_is_blocked():
    assert choose_path(RecoveryStatus.DISPUTED, NOW - timedelta(hours=1), NOW, Decimal("100"), AMT) == "BLOCKED"


@pytest.mark.parametrize("status", [RecoveryStatus.OFFSET, RecoveryStatus.INVOICED, RecoveryStatus.WAIVED,
                                    RecoveryStatus.RECOVERED])
def test_finished_recoveries_are_blocked(status):
    assert choose_path(status, NOW - timedelta(hours=1), NOW, None, AMT) == "BLOCKED"


def test_offset_when_unpaid_claim_covers_amount():
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW - timedelta(hours=1), NOW, Decimal("48.00"), AMT) == "OFFSET"
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW - timedelta(hours=1), NOW, Decimal("30.00"), AMT) == "OFFSET"


def test_invoice_when_no_claim_or_not_enough():
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW - timedelta(hours=1), NOW, None, AMT) == "INVOICE"
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW - timedelta(hours=1), NOW, Decimal("10"), AMT) == "INVOICE"


def test_window_end_is_exclusive():
    assert choose_path(RecoveryStatus.NOTICE_SENT, NOW, NOW, None, AMT) == "INVOICE"


def test_offsets_never_go_negative():
    assert apply_offsets(Decimal("48.00"), [Decimal("30.00")]) == Decimal("18.00")
    assert apply_offsets(Decimal("20.00"), [Decimal("30.00")]) == Decimal("0.00")
    assert apply_offsets(Decimal("48.00"), []) == Decimal("48.00")


def test_invoice_payload_shape():
    p = build_invoice_payload("a@example.com", AMT, "MYR", "note", REF)
    assert p["detail"]["currency_code"] == "MYR" and p["detail"]["reference"] == REF
    assert p["detail"]["note"] == "note" and "invoice_number" not in p["detail"]
    assert p["primary_recipients"][0]["billing_info"]["email_address"] == "a@example.com"
    assert p["items"][0]["unit_amount"] == {"currency_code": "MYR", "value": "30.00"}


def test_mock_invoice_id_is_stable_per_invoice_number():
    p = build_invoice_payload("a@example.com", AMT, "MYR", "note", REF, invoice_number="RCV-abc")
    first = mock_invoice_id(p)
    assert first.startswith("INV2-") and len(first) == len("INV2-XXXX-XXXX-XXXX-XXXX")
    assert mock_invoice_id(p) == first


def test_invoice_id_from_link_or_body():
    assert invoice_id_from_response({"id": "INV2-AAAA"}) == "INV2-AAAA"
    link = {"rel": "self", "method": "GET",
            "href": "https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-BBBB-CCCC"}
    assert invoice_id_from_response(link) == "INV2-BBBB-CCCC"


def test_mock_mode_never_touches_the_network(monkeypatch):
    monkeypatch.setattr(settings, "PAYPAL_MOCK_MODE", True)
    monkeypatch.setattr(paypal_invoicing, "_toolkit_create_and_send",
                        lambda p: pytest.fail("toolkit called in mock mode"))
    p = build_invoice_payload("a@example.com", AMT, "MYR", "note", REF, invoice_number="RCV-1")
    assert asyncio.run(create_and_send_invoice(p)).startswith("INV2-")


def test_toolkit_path_keeps_our_reference_and_note(monkeypatch):
    from paypal_agent_toolkit.shared.paypal_client import PayPalClient as ToolkitClient

    calls = []

    def fake_post(self, uri, payload):
        calls.append((uri, payload))
        if uri.endswith("/send"):
            return {}
        return {"rel": "self", "method": "GET", "href": f"https://x/v2/invoicing/invoices/INV2-TOOL-0001"}

    monkeypatch.setattr(ToolkitClient, "post", fake_post)
    monkeypatch.setattr(settings, "PAYPAL_MOCK_MODE", False)
    p = build_invoice_payload("a@example.com", AMT, "MYR", "Our note", REF, invoice_number="RCV-2")

    assert asyncio.run(create_and_send_invoice(p)) == "INV2-TOOL-0001"
    (create_uri, create_body), (send_uri, send_body) = calls
    assert create_uri == "/v2/invoicing/invoices" and create_body["detail"]["reference"] == REF
    assert create_body["detail"]["invoice_number"] == "RCV-2"
    assert send_uri == "/v2/invoicing/invoices/INV2-TOOL-0001/send"
    assert send_body["note"] == "Our note" and send_body["send_to_recipient"] is True


def test_rest_fallback_creates_then_sends(monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json={"access_token": "T", "expires_in": 3600})
        seen.append((request.method, request.url.path, json.loads(request.content or b"{}")))
        if request.url.path == "/v2/invoicing/invoices":
            return httpx.Response(201, json={"rel": "self", "method": "GET",
                                             "href": "https://x/v2/invoicing/invoices/INV2-REST-0001"})
        return httpx.Response(202, json={})

    client = PayPalClient("https://api-m.sandbox.paypal.com", "id", "secret", transport=httpx.MockTransport(handler))
    monkeypatch.setattr(settings, "PAYPAL_MOCK_MODE", False)
    monkeypatch.setattr(paypal_invoicing, "_toolkit_available", lambda: False)
    monkeypatch.setattr(paypal_invoicing, "get_paypal_client", lambda: client)
    p = build_invoice_payload("a@example.com", AMT, "MYR", "Our note", REF)

    assert asyncio.run(create_and_send_invoice(p)) == "INV2-REST-0001"
    assert [(m, path) for m, path, _ in seen] == [
        ("POST", "/v2/invoicing/invoices"), ("POST", "/v2/invoicing/invoices/INV2-REST-0001/send")]
    assert seen[1][2]["note"] == "Our note"


def test_fallback_note_is_the_copy_deck_text():
    assert fallback_note("Breakfast was included", AMT, "MYR", REF) == (
        "We paid MYR 30.00 more than the approved amount for claim RC-1a2b3c4d: Breakfast was included. "
        "Please settle this invoice, or reply to dispute it.")


def test_clean_note_rejects_a_note_with_the_wrong_amount():
    good = json.dumps({"note": "We overpaid MYR 30.00 on claim RC-1a2b3c4d. Reply to dispute it."})
    assert _clean_note(good, AMT, "MYR", REF).startswith("We overpaid")
    assert _clean_note(json.dumps({"note": "We overpaid MYR 300.00 on claim RC-1a2b3c4d."}), AMT, "MYR", REF) is None
    assert _clean_note("not json", AMT, "MYR", REF) is None
    dashed = json.dumps({"note": "MYR 30.00 on RC-1a2b3c4d \u2014 reply to dispute."})
    assert "\u2014" not in _clean_note(dashed, AMT, "MYR", REF)


def test_draft_note_falls_back_when_the_llm_fails(monkeypatch):
    import engine.llm

    def broken():
        raise RuntimeError("no model")

    monkeypatch.setattr(engine.llm, "get_chat_llm", broken)
    note = asyncio.run(draft_recovery_note("Hotel stay", "Breakfast was included", AMT, "MYR", REF))
    assert note == fallback_note("Breakfast was included", AMT, "MYR", REF)


def test_deadline_is_shown_in_malaysia_time():
    assert format_deadline(datetime(2026, 11, 8, 10, 0, tzinfo=timezone.utc)) == "8 Nov, 6:00 pm MYT"
    assert format_deadline(datetime(2026, 11, 8, 1, 5, tzinfo=timezone.utc)) == "8 Nov, 9:05 am MYT"
