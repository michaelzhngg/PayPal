from engine.risk.types import RiskSignal, Severity, SignalCode, make_signal

MIN_TOLERANCE = 0.05
RELATIVE_TOLERANCE = 0.02


def check_totals(
    line_amounts: list[float],
    tax: float | None,
    service_charge: float | None,
    total: float,
    document_id: str | None = None,
) -> RiskSignal | None:
    if not line_amounts:
        return None
    expected = sum(line_amounts) + (tax or 0.0) + (service_charge or 0.0)
    # Cents, so float noise in 1.05 - 1.0 cannot flag a gap equal to the tolerance.
    difference = round(abs(total - expected), 2)
    tolerance = max(MIN_TOLERANCE, RELATIVE_TOLERANCE * abs(total))
    if not difference > tolerance:
        return None
    return make_signal(
        SignalCode.ARITHMETIC_MISMATCH,
        Severity.MEDIUM,
        f"Line items, tax and service charge add up to {expected:,.2f}, but the receipt total reads {total:,.2f}. "
        "This can be an OCR misread, so compare with the image.",
        {
            "expected_total": round(expected, 2),
            "total": total,
            "difference": difference,
            "tolerance": round(tolerance, 2),
        },
        document_id,
    )
