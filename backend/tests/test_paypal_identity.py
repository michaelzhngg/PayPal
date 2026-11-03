from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import pytest

from engine.services.paypal_client import PayPalUser
from api.paypal import build_connect_url, make_state, read_state, link_update, cooldown_until, mask_email

NOW = datetime(2026, 11, 3, 10, tzinfo=timezone.utc)
U = UUID("12345678-1234-5678-1234-567812345678")


def test_state_roundtrip_and_expiry():
    tok = make_state(U, "s", NOW)
    assert read_state(tok, "s", NOW + timedelta(minutes=9)) == U
    with pytest.raises(ValueError):
        read_state(tok, "s", NOW + timedelta(minutes=11))
    with pytest.raises(ValueError):
        read_state(tok, "other-secret", NOW)


def test_state_rejects_garbage():
    with pytest.raises(ValueError):
        read_state("not-a-token", "s", NOW)


def test_first_link_has_no_cooldown():
    upd = link_update(None, False, PayPalUser("P1", "a@b.com", True), NOW)
    assert upd["paypal_payer_id"] == "P1" and upd["paypal_verified"] is True
    assert upd["payout_destination_changed_at"] is None


def test_changed_account_starts_cooldown():
    upd = link_update("P0", True, PayPalUser("P1", "a@b.com", True), NOW)
    assert upd["payout_destination_changed_at"] == NOW
    assert cooldown_until(NOW, 72) == NOW + timedelta(hours=72)
    assert cooldown_until(None, 72) is None


def test_unlink_then_link_other_account_still_cools_down():
    assert link_update(None, True, PayPalUser("P9", "x@y.com", True), NOW)["payout_destination_changed_at"] == NOW


def test_same_account_relink_keeps_no_cooldown():
    assert "payout_destination_changed_at" not in link_update("P1", True, PayPalUser("P1", "a@b.com", True), NOW)


def test_mask_email():
    assert mask_email("aisyah.rahman@gmail.com") == "a***@gmail.com"


def test_connect_url():
    url = build_connect_url("https://www.sandbox.paypal.com", "CID", "https://api.example/api/v1/paypal/callback", "ST")
    parsed = urlparse(url)
    q = parse_qs(parsed.query)
    assert parsed.netloc == "www.sandbox.paypal.com" and parsed.path == "/connect"
    assert q["client_id"] == ["CID"] and q["response_type"] == ["code"] and q["state"] == ["ST"]
    assert q["scope"] == ["openid email https://uri.paypal.com/services/paypalattributes"]
    assert q["redirect_uri"] == ["https://api.example/api/v1/paypal/callback"]
