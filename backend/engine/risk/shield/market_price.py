"""PRICE_ABOVE_MARKET: compares a receipt line with what Channel3 lists the product for, in USD.

`check_market_price` is pure. The caller passes the API key to `channel3_search`, since this package can't read settings.
"""

from statistics import median
from typing import Callable

import httpx

from engine.risk.types import RiskSignal, Severity, SignalCode, make_signal

SEARCH_URL = "https://api.trychannel3.com/v1/search"
TIMEOUT_SECONDS = 4.0
SEARCH_LIMIT = 10
MIN_OFFERS = 3
ABOVE_MEDIAN_RATIO = 1.5
_MAX_QUERY_CHARS = 200


def check_market_price(
    description: str,
    unit_price: float,
    fx_to_usd: float,
    search: Callable[[str], list[float]],
    document_id: str | None = None,
    currency: str = "USD",
) -> RiskSignal | None:
    """Fires when the claimed price in USD is more than 1.5 times the median offer. `search` errors propagate."""
    if unit_price <= 0 or fx_to_usd <= 0:
        return None
    prices = search(description)
    if len(prices) < MIN_OFFERS:
        return None
    median_usd = median(prices)
    claimed_usd = unit_price * fx_to_usd
    if claimed_usd <= ABOVE_MEDIAN_RATIO * median_usd:
        return None
    typical = median_usd / fx_to_usd
    return make_signal(
        SignalCode.PRICE_ABOVE_MARKET,
        Severity.MEDIUM,
        f"Claimed {currency} {unit_price:,.2f}; typical price {currency} {typical:,.2f} "
        f"({len(prices)} offers, Channel3).",
        # `claimed` and `median` are in the claim's currency: the HR evidence panel formats them with it.
        {
            "description": description,
            "claimed": round(unit_price, 2),
            "median": round(typical, 2),
            "n": len(prices),
            "claimed_usd": round(claimed_usd, 2),
            "median_usd": round(median_usd, 2),
        },
        document_id,
    )


def usd_prices(data: dict) -> list[float]:
    """One price per product: its cheapest USD offer. Channel3 keeps prices at products[].offers[].price.price."""
    prices = []
    for product in data.get("products") or []:
        offers = [o.get("price") or {} for o in product.get("offers") or []]
        amounts = [p["price"] for p in offers if p.get("currency") == "USD" and (p.get("price") or 0) > 0]
        if amounts:
            prices.append(float(min(amounts)))
    return prices


def channel3_search(query: str, api_key: str) -> list[float]:
    resp = httpx.post(
        SEARCH_URL,
        json={"query": query[:_MAX_QUERY_CHARS], "limit": SEARCH_LIMIT, "config": {"currency": "USD"}},
        headers={"x-api-key": api_key},
        timeout=TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return usd_prices(resp.json())
