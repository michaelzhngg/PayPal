"""Channel3 market-price check. Fakes only: no call reaches Channel3."""
import json
from datetime import date, datetime, timezone

import httpx
import pytest
import respx

from engine.risk.shield.market_price import SEARCH_URL, TIMEOUT_SECONDS, channel3_search, check_market_price, usd_prices
from engine.risk.shield.run import PriceCheck, ShieldDoc, run_shield
from engine.risk.timeline import LABELS, employee_safe
from engine.risk.types import ClaimLite, Severity, SignalCode

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)
CATEGORIES = frozenset({"equipment", "it equipment"})
CHEAP = lambda query: [100.0, 110.0, 120.0]  # noqa: E731


def test_signal_fires_above_one_and_a_half_times_the_median():
    s = check_market_price("Dell monitor", 200, 1.0, CHEAP, "d1")
    assert s.code == SignalCode.PRICE_ABOVE_MARKET and s.severity == Severity.MEDIUM and s.document_id == "d1"
    assert s.evidence["median_usd"] == 110


def test_claimed_150_is_not_flagged():
    assert check_market_price("Dell monitor", 150, 1.0, CHEAP) is None


def test_exactly_one_and_a_half_times_is_not_flagged():
    assert check_market_price("Dell monitor", 165, 1.0, CHEAP) is None


def test_fewer_than_three_prices_is_not_enough():
    assert check_market_price("Dell monitor", 900, 1.0, lambda q: [100.0, 110.0]) is None


def test_fx_converts_the_claim_and_evidence_is_in_the_claim_currency():
    s = check_market_price("Dell monitor", 1000, 0.25, CHEAP, currency="MYR")
    assert s.evidence["claimed_usd"] == 250 and s.evidence["median_usd"] == 110
    # The HR evidence panel reads claimed, median and n and formats them in the claim's currency.
    assert (s.evidence["claimed"], s.evidence["median"], s.evidence["n"]) == (1000, 440, 3)
    assert s.message == "Claimed MYR 1,000.00; typical price MYR 440.00 (3 offers, Channel3)."


@pytest.mark.parametrize("price,fx", [(0, 1.0), (-5, 1.0), (100, 0), (100, -1)])
def test_unusable_numbers_skip_the_search(price, fx):
    def never(query):
        raise AssertionError("no search expected")
    assert check_market_price("Dell monitor", price, fx, never) is None


# Shape from the Channel3 API reference: products[].offers[].price = {price, compare_at_price, currency}.
def _product(*offers):
    return {"id": "p", "title": "t", "offers": [
        {"url": "u", "domain": "d", "availability": "InStock", "price": {"price": p, "compare_at_price": None, "currency": c}}
        for p, c in offers
    ]}


def test_usd_prices_takes_each_products_cheapest_usd_offer():
    data = {"products": [_product((120, "USD"), (100, "USD")), _product((90, "EUR")), _product((0, "USD")), {"id": "x"}],
            "next_page_token": None}
    assert usd_prices(data) == [100.0]
    assert usd_prices({}) == []


@respx.mock
def test_channel3_search_request_and_parse():
    route = respx.post(SEARCH_URL).mock(return_value=httpx.Response(200, json={"products": [_product((100, "USD"))]}))
    assert channel3_search("x" * 500, "KEY") == [100.0]
    request = route.calls.last.request
    assert request.headers["x-api-key"] == "KEY"
    body = json.loads(request.content)
    assert len(body["query"]) == 200 and body["limit"] == 10 and body["config"] == {"currency": "USD"}
    assert request.extensions["timeout"]["read"] == TIMEOUT_SECONDS


@respx.mock
@pytest.mark.parametrize("status", [401, 402, 500])
def test_channel3_errors_raise_for_the_caller_to_absorb(status):
    respx.post(SEARCH_URL).mock(return_value=httpx.Response(status))
    with pytest.raises(httpx.HTTPStatusError):
        channel3_search("monitor", "KEY")


def claim():
    return ClaimLite(reim_id="r1", user_id="u1", merchant="M", expense_date=date(2026, 11, 3), amount=900.0,
                     created_at=NOW, status="REVIEW")


def equipment(*lines, category="Equipment", **extra):
    return ShieldDoc(document_id="d1", extracted={
        "category": category, "currency": "MYR", "total_amount": sum(amount for _, amount in lines),
        "line_items": [{"description": d, "amount": a} for d, a in lines], **extra})


def check(search=CHEAP, fx=1.0):
    return PriceCheck(search=search, categories=CATEGORIES, fx_to_usd=fx, currency="MYR")


def shield(doc, price_check):
    steps = []
    return run_shield([doc] if isinstance(doc, ShieldDoc) else doc, claim(), [], [], 100.0, steps.append,
                      price_check=price_check), steps


def price_steps(steps):
    return [s for s in steps if s.step == "shield.price"]


def test_no_price_check_means_no_step_and_no_search():
    signals, steps = shield(equipment(("Dell monitor", 900.0)), None)
    assert signals == [] and price_steps(steps) == []


def test_inflated_equipment_receipt_warns_hr_with_the_signal_copy():
    signals, steps = shield(equipment(("Dell monitor", 900.0)), check())
    assert [s.code for s in signals] == [SignalCode.PRICE_ABOVE_MARKET]
    [running, final] = price_steps(steps)
    assert running.status == "running" and final.status == "warn"
    assert final.label == LABELS["shield.price"]
    assert final.detail == "Claimed MYR 900.00; typical price MYR 110.00 (3 offers, Channel3)."


def test_employee_view_of_the_warning_says_nothing():
    _, steps = shield(equipment(("Dell monitor", 900.0)), check())
    safe = employee_safe(price_steps(steps)[-1])
    assert (safe.status, safe.detail) == ("done", None)


def test_employee_view_of_a_clean_price_step_has_no_detail_either():
    _, steps = shield(equipment(("Dell monitor", 110.0)), check())
    final = price_steps(steps)[-1]
    assert final.status == "done" and final.detail
    assert employee_safe(final).detail is None


@pytest.mark.parametrize("error", [httpx.TimeoutException("slow"), httpx.ConnectError("down"), ValueError("bad json"),
                                   KeyError("price")])
def test_channel3_failure_never_fails_the_claim(error):
    calls = []

    def boom(query):
        calls.append(query)
        raise error

    doc = equipment(("Dell monitor", 900.0), ("Keyboard", 300.0))
    signals, steps = shield(doc, check(boom))
    assert signals == []
    assert price_steps(steps)[-1].status == "done"
    assert not [s for s in steps if s.status == "fail"]
    # One failed call ends the lookups, so an outage costs a single timeout.
    assert calls == ["Dell monitor"]


def test_failure_keeps_signals_already_found():
    def second_fails(query):
        if query == "Keyboard":
            raise httpx.ConnectError("down")
        return [100.0, 110.0, 120.0]

    docs = [equipment(("Dell monitor", 900.0)), ShieldDoc(document_id="d2", extracted={
        "category": "Equipment", "line_items": [{"description": "Keyboard", "amount": 80.0}]})]
    signals, _ = shield(docs, check(second_fails))
    assert [s.document_id for s in signals] == ["d1"]


@pytest.mark.parametrize("doc", [
    equipment(("Nasi lemak", 900.0), category="Meals"),
    ShieldDoc(document_id="d1", extracted={"category": "Equipment", "currency": "USD",
                                           "line_items": [{"description": "Dell monitor", "amount": 900.0}]}),
    equipment(("ab", 900.0)),
    equipment(("Dell monitor", 0)),
    ShieldDoc(document_id="d1", extracted={"category": "Equipment", "line_items": "none"}),
], ids=["other-category", "other-currency", "short-description", "zero-amount", "bad-line-items"])
def test_receipts_the_check_does_not_apply_to_are_skipped(doc):
    def never(query):
        raise AssertionError("no search expected")
    signals, steps = shield(doc, check(never))
    assert signals == [] and price_steps(steps) == []


def test_unread_currency_still_checks():
    doc = equipment(("Dell monitor", 900.0), currency="Not found in Receipt")
    assert shield(doc, check())[0]


def test_category_match_ignores_case():
    assert shield(equipment(("Dell monitor", 900.0), category="IT EQUIPMENT "), check())[0]


def test_quantity_is_divided_out_when_present():
    doc = ShieldDoc(document_id="d1", extracted={"category": "Equipment", "line_items": [
        {"description": "Dell monitor", "amount": 330.0, "quantity": 3}]})
    assert shield(doc, check())[0] == []


def test_one_signal_per_receipt_the_largest_overage():
    signals, _ = shield(equipment(("Mouse", 200.0), ("Dell monitor", 900.0)), check())
    assert [s.evidence["description"] for s in signals] == ["Dell monitor"]


def test_lookups_are_capped_dearest_first():
    calls = []

    def search(query):
        calls.append(query)
        return []

    lines = [(f"Item {n}", float(n)) for n in range(1, 7)]
    shield(equipment(*lines), check(search))
    assert calls == ["Item 6", "Item 5", "Item 4"]


def test_fewer_than_three_offers_is_a_clean_step():
    signals, steps = shield(equipment(("Obscure part", 900.0)), check(lambda q: [1.0]))
    assert signals == [] and price_steps(steps)[-1].status == "done"
