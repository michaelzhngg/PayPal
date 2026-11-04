import hashlib
import math
from datetime import date

import imagehash
from PIL import Image, ImageOps

from engine.risk.types import DocFingerprint, RiskSignal, Severity, SignalCode, make_signal

_AMOUNT_TOLERANCE = 0.01


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def phash_file(path: str) -> str | None:
    """Perceptual hash as hex, or None for PDFs and files Pillow can't read."""
    try:
        with Image.open(path) as img:
            # Hash what a viewer sees, so a copy saved without the Orientation tag still matches.
            return str(imagehash.phash(ImageOps.exif_transpose(img).convert("L")))
    except (OSError, ValueError, Image.DecompressionBombError):
        return None


def hamming(a: str, b: str) -> int:
    if len(a) != len(b):
        raise ValueError(f"hash lengths differ: {len(a)} vs {len(b)}")
    return (int(a, 16) ^ int(b, 16)).bit_count()


def amount_and_date(extracted: dict | None) -> tuple[float | None, date | None]:
    """Total and date as the OCR read them, for DocFingerprint. Unknown values become None."""
    extracted = extracted or {}
    amount = None
    try:
        value = float(extracted.get("total_amount"))
        # The OCR prompt returns 0 when it finds no total.
        if math.isfinite(value) and value > 0:
            amount = value
    except (TypeError, ValueError):
        pass
    expense_date = None
    raw = extracted.get("date")
    if isinstance(raw, str):
        try:
            expense_date = date.fromisoformat(raw.strip()[:10])
        except ValueError:
            pass
    return amount, expense_date


def _details_agree(doc: DocFingerprint, other: DocFingerprint) -> bool:
    if doc.amount is not None and other.amount is not None:
        if abs(doc.amount - other.amount) > _AMOUNT_TOLERANCE + 1e-9:
            return False
    if doc.expense_date is not None and other.expense_date is not None:
        if doc.expense_date != other.expense_date:
            return False
    return True


def _match(doc: DocFingerprint, other: DocFingerprint, max_distance: int) -> dict | None:
    if doc.sha256 and doc.sha256 == other.sha256:
        return {"match": "sha256", "distance": 0}
    if not doc.phash or not other.phash or len(doc.phash) != len(other.phash):
        return None
    distance = hamming(doc.phash, other.phash)
    # Receipts from one app share a layout, so a close pHash alone isn't enough.
    if distance <= max_distance and _details_agree(doc, other):
        return {"match": "phash", "distance": distance}
    return None


def find_duplicates(
    doc: DocFingerprint, candidates: list[DocFingerprint], max_distance: int = 6
) -> RiskSignal | None:
    matches = []
    for other in candidates:
        if other.document_id == doc.document_id or other.reim_status == "REJECTED":
            continue
        found = _match(doc, other, max_distance)
        if found is None:
            continue
        matches.append(
            {
                "document_id": other.document_id,
                "reim_id": other.reim_id,
                "user_id": other.user_id,
                "reim_status": other.reim_status,
                "same_claim": doc.reim_id is not None and other.reim_id == doc.reim_id,
                "same_user": other.user_id == doc.user_id,
                **found,
            }
        )
    if not matches:
        return None
    matches.sort(key=lambda m: (m["match"] != "sha256", m["distance"]))

    in_claim = [m for m in matches if m["same_claim"]]
    elsewhere = [m for m in matches if not m["same_claim"]]
    parts = []
    if in_claim:
        parts.append("is attached more than once in this claim")
    if elsewhere:
        who = "the same employee" if all(m["same_user"] for m in elsewhere) else "another employee"
        parts.append(f"matches {len(elsewhere)} document(s) {who} submitted in other claims")
    kind = "an identical file" if matches[0]["match"] == "sha256" else "a re-saved or cropped copy"
    message = f"This receipt {' and '.join(parts)} (best match: {kind}). Compare the documents before paying."
    return make_signal(
        SignalCode.DUPLICATE_RECEIPT,
        Severity.HIGH,
        message,
        {"matches": matches, "max_distance": max_distance},
        doc.document_id,
    )
