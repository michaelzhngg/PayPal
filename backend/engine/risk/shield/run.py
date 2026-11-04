"""Runs every Receipt Shield check on one claim and reports each as a timeline step.

Steps carry HR-grade detail. Callers that stream to the employee pass them through
engine.risk.timeline.employee_safe first.
"""

import math
import re
from typing import Any, Callable

from pydantic import BaseModel, Field

from engine.risk.shield.arithmetic import check_totals
from engine.risk.shield.edits import signal_from_visual_anomaly, signals_from_human_edit
from engine.risk.shield.fingerprint import find_duplicates
from engine.risk.shield.gaming import detect_near_threshold, detect_split
from engine.risk.shield.injection import scan_text
from engine.risk.timeline import make_step
from engine.risk.types import ClaimLite, DocFingerprint, RiskSignal, SignalCode, TimelineStep

Emit = Callable[[TimelineStep], None]

_NOT_A_NUMBER = re.compile(r"[^\d.\-]")


class ShieldDoc(BaseModel):
    document_id: str
    extracted: dict = Field(default_factory=dict)
    # Fields the employee typed over the OCR values; scanned for injection like the OCR text.
    edited: dict = Field(default_factory=dict)
    change_summary: dict = Field(default_factory=dict)
    # Provenance signals saved at upload (supporting_documents.shield["provenance"]).
    stored_signals: list[RiskSignal] = Field(default_factory=list)
    fingerprint: DocFingerprint | None = None


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for v in value.values() for s in _strings(v)]
    if isinstance(value, (list, tuple)):
        return [s for v in value for s in _strings(v)]
    return []


def receipt_text(doc: ShieldDoc) -> str:
    """Every string the OCR returned (visible_text included) plus the employee's edits."""
    return "\n".join(_strings(doc.extracted) + _strings(doc.edited))


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, str):
        value = _NOT_A_NUMBER.sub("", value.replace(",", ""))
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _line_amounts(extracted: dict) -> list[float]:
    items = extracted.get("line_items")
    if not isinstance(items, list):
        return []
    amounts = [_number(i.get("amount")) for i in items if isinstance(i, dict)]
    return [a for a in amounts if a is not None]


def _hr_detail(signals: list[RiskSignal]) -> str:
    return " ".join(s.message for s in signals)


def _finish(emit: Emit, step: str, signals: list[RiskSignal], clean_detail: str, warn_detail: str | None = None) -> None:
    if signals:
        emit(make_step(step, "warn", warn_detail or _hr_detail(signals)))
    else:
        emit(make_step(step, "done", clean_detail))


def _injection(docs: list[ShieldDoc]) -> tuple[list[RiskSignal], str | None]:
    found = [s for d in docs if (s := scan_text(receipt_text(d), d.document_id))]
    if not found:
        return [], None
    snippet = found[0].evidence.get("matches", [""])[0]
    return found, f"Hidden instructions found: {snippet}"


def _duplicates(docs: list[ShieldDoc], candidates: list[DocFingerprint]) -> list[RiskSignal]:
    # The claim's own documents join the pool so a receipt attached twice is caught;
    # find_duplicates skips a document's match against itself.
    own = [d.fingerprint for d in docs if d.fingerprint]
    own_ids = {f.document_id for f in own}
    pool = [c for c in candidates if c.document_id not in own_ids] + own
    return [s for f in own if (s := find_duplicates(f, pool))]


def _duplicate_detail(candidates: list[DocFingerprint], docs: list[ShieldDoc]) -> str:
    own_ids = {d.document_id for d in docs}
    n = sum(1 for c in candidates if c.document_id not in own_ids)
    if n == 0:
        return "No earlier receipts to compare"
    return f"No match across {n:,} receipt{'s' if n != 1 else ''}"


def _provenance(docs: list[ShieldDoc]) -> list[RiskSignal]:
    signals: list[RiskSignal] = []
    for d in docs:
        signals += [s.model_copy(deep=True) for s in d.stored_signals]
        anomaly = signal_from_visual_anomaly(d.extracted, d.document_id)
        if anomaly:
            signals.append(anomaly)
        signals += signals_from_human_edit(d.change_summary, d.document_id)
    return signals


def _arithmetic(docs: list[ShieldDoc]) -> tuple[list[RiskSignal], bool]:
    signals, checked = [], False
    for d in docs:
        lines = _line_amounts(d.extracted)
        total = _number(d.extracted.get("total_amount"))
        if not lines or total is None:
            continue
        checked = True
        s = check_totals(
            lines, _number(d.extracted.get("tax_amount")), _number(d.extracted.get("service_charge")),
            total, d.document_id,
        )
        if s:
            signals.append(s)
    return signals, checked


def _gaming(claim: ClaimLite, recent: list[ClaimLite], auto_limit: float) -> list[RiskSignal]:
    others = [c for c in recent if c.reim_id != claim.reim_id]
    found = [
        detect_split(claim, others, auto_limit),
        detect_near_threshold(claim.amount, auto_limit, [c.amount for c in others]),
    ]
    return [s for s in found if s]


def run_shield(
    docs: list[ShieldDoc],
    claim: ClaimLite,
    recent: list[ClaimLite],
    candidates: list[DocFingerprint],
    auto_limit: float,
    emit: Emit,
) -> list[RiskSignal]:
    """A check that raises emits `fail` and re-raises, so the claim falls back to manual review."""
    out: list[RiskSignal] = []

    def run(step: str, check: Callable[[], None]) -> None:
        emit(make_step(step, "running"))
        try:
            check()
        except Exception:
            emit(make_step(step, "fail", "This check could not run."))
            raise

    def injection() -> None:
        signals, detail = _injection(docs)
        out.extend(signals)
        _finish(emit, "shield.injection", signals, "None found", detail)

    def duplicate() -> None:
        signals = _duplicates(docs, candidates)
        out.extend(signals)
        _finish(emit, "shield.duplicate", signals, _duplicate_detail(candidates, docs))

    def provenance() -> None:
        signals = _provenance(docs)
        out.extend(signals)
        _finish(emit, "shield.provenance", signals, "No editing or AI traces found")

    def arithmetic() -> None:
        signals, checked = _arithmetic(docs)
        out.extend(signals)
        _finish(emit, "shield.arithmetic", signals, "Items + tax = total" if checked else "No line items to add up")

    def split() -> None:
        signals = _gaming(claim, recent, auto_limit)
        out.extend(signals)
        _finish(emit, "shield.split", signals, "No related claims")

    run("shield.injection", injection)
    run("shield.duplicate", duplicate)
    run("shield.provenance", provenance)
    run("shield.arithmetic", arithmetic)
    run("shield.split", split)
    return out


def split_related(signals: list[RiskSignal]) -> list[str]:
    """Claim ids a SPLIT_CLAIM signal links to this one."""
    return [rid for s in signals if s.code == SignalCode.SPLIT_CLAIM for rid in s.evidence.get("related", [])]
