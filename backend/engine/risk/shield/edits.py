from engine.risk.types import RiskSignal, Severity, SignalCode, make_signal

_EDIT_SIGNALS = {
    "HIGH": (SignalCode.HUMAN_EDIT_HIGH, Severity.HIGH),
    "MEDIUM": (SignalCode.HUMAN_EDIT_MEDIUM, Severity.MEDIUM),
}

_NOT_FOUND = "Not found in Receipt"


def signals_from_human_edit(change_summary: dict, document_id: str | None) -> list[RiskSignal]:
    """Maps a change_detector.detect_changes() summary to at most one signal."""
    risk = str((change_summary or {}).get("overall_risk") or "NONE").upper()
    if risk not in _EDIT_SIGNALS:
        return []
    code, severity = _EDIT_SIGNALS[risk]
    changes = change_summary.get("changes_by_field") or {}
    fields = sorted(changes)
    message = "The employee corrected fields the OCR read from the receipt"
    message += f": {', '.join(fields)}." if fields else "."
    if severity == Severity.HIGH:
        message += " At least one change affects the amount or date."
    return [
        make_signal(
            code,
            severity,
            message,
            {
                "fields": fields,
                "changes": {f: {k: changes[f].get(k) for k in ("original", "edited", "severity")} for f in fields},
            },
            document_id,
        )
    ]


def _truthy(value: object) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes")
    return value is True


def signal_from_visual_anomaly(extracted: dict, document_id: str | None) -> RiskSignal | None:
    if not _truthy((extracted or {}).get("visual_anomalies_detected")):
        return None
    description = extracted.get("anomaly_description")
    evidence = {}
    if isinstance(description, str) and description.strip() and description.strip() != _NOT_FOUND:
        evidence["description"] = description.strip()
    # The description is model output from reading the receipt, so it stays in evidence, out of the HR message.
    return make_signal(
        SignalCode.VISUAL_ANOMALY,
        Severity.MEDIUM,
        "The OCR model saw possible signs of editing on the receipt image. Compare it with the extracted fields.",
        evidence,
        document_id,
    )
