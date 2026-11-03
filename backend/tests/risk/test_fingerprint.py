from datetime import date
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from engine.risk.shield.fingerprint import amount_and_date, find_duplicates, hamming, phash_file, sha256_file
from engine.risk.types import DocFingerprint

RECEIPTS = Path(__file__).resolve().parents[3] / "demo" / "receipts"


def receipt(path, lines):
    # Black bars stand in for printed lines, so pHash has strong structure to compare.
    img = Image.new("RGB", (400, 600), "white")
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        if line:
            d.rectangle([20, 20 + i * 28, 20 + 12 * len(line), 36 + i * 28], fill="black")
    img.save(path, quality=95)
    return path


def fp(doc_id, path, reim="r0", status="PAID", user="u2"):
    return DocFingerprint(document_id=doc_id, reim_id=reim, user_id=user, sha256=sha256_file(path),
                          phash=phash_file(path), reim_status=status)


LINES = ["GRAB RIDE", "KLCC -> KLIA", "Fare 45.00", "Fee 3.00", "TOTAL RM 48.00"] * 3


def test_recompressed_copy_is_duplicate(tmp_path):
    a = receipt(tmp_path / "a.jpg", LINES)
    Image.open(a).save(tmp_path / "b.jpg", quality=60)
    s = find_duplicates(fp("new", tmp_path / "b.jpg", reim="r9", status=None), [fp("old", a)])
    assert s is not None and s.code.value == "DUPLICATE_RECEIPT" and s.evidence["matches"][0]["document_id"] == "old"
    assert s.severity.value == "HIGH" and s.document_id == "new"


def test_different_receipt_is_not_duplicate(tmp_path):
    a = receipt(tmp_path / "a.jpg", LINES)
    b = receipt(tmp_path / "b.jpg", ["HOTEL SENTRAL KUALA LUMPUR"] + [""] * 12 + ["2 nights", "TOTAL RM 620.00"])
    assert find_duplicates(fp("new", b, reim="r9", status=None), [fp("old", a)]) is None


def test_rejected_and_self_matches_ignored(tmp_path):
    a = receipt(tmp_path / "a.jpg", LINES)
    assert find_duplicates(fp("x", a, reim="r9"), [fp("x", a), fp("old", a, status="REJECTED")]) is None


def test_same_layout_different_amount_is_not_duplicate(tmp_path):
    # Two different e-receipts from the same app look alike; only the numbers differ.
    a = receipt(tmp_path / "a.jpg", LINES)
    old = fp("old", a).model_copy(update={"amount": 48.0})
    new = fp("new", a, reim="r9", status=None).model_copy(update={"amount": 52.0, "sha256": "f" * 64})
    assert find_duplicates(new, [old]) is None


def test_same_layout_different_date_is_not_duplicate(tmp_path):
    a = receipt(tmp_path / "a.jpg", LINES)
    old = fp("old", a).model_copy(update={"expense_date": date(2026, 11, 1)})
    new = fp("new", a, reim="r9").model_copy(update={"expense_date": date(2026, 11, 2), "sha256": "f" * 64})
    assert find_duplicates(new, [old]) is None


def test_identical_file_matches_even_when_amounts_differ(tmp_path):
    a = receipt(tmp_path / "a.jpg", LINES)
    old = fp("old", a).model_copy(update={"amount": 48.0})
    new = fp("new", a, reim="r9").model_copy(update={"amount": 52.0})
    s = find_duplicates(new, [old])
    assert s is not None and s.evidence["matches"][0]["match"] == "sha256"


def test_same_image_twice_in_one_claim_is_flagged(tmp_path):
    a = receipt(tmp_path / "a.jpg", LINES)
    first, second = fp("d1", a, reim="r9", status=None, user="u1"), fp("d2", a, reim="r9", status=None, user="u1")
    s = find_duplicates(second, [first, second])
    assert s is not None and [m["document_id"] for m in s.evidence["matches"]] == ["d1"]
    assert s.evidence["matches"][0]["same_claim"] is True and "more than once in this claim" in s.message


def test_s5_matches_s1_from_another_employee():
    s1 = fp("s1", RECEIPTS / "s1_ride.jpg", reim="claim-s1", status="PAID", user="employee1")
    s5 = fp("s5", RECEIPTS / "s5_dup.jpg", reim="claim-s5", status=None, user="employee2")
    assert s1.sha256 != s5.sha256
    s = find_duplicates(s5, [s1])
    assert s is not None and s.code.value == "DUPLICATE_RECEIPT"
    [m] = s.evidence["matches"]
    assert m["reim_id"] == "claim-s1" and m["match"] == "phash" and m["distance"] <= 6 and m["same_user"] is False
    assert "another employee" in s.message


def test_s5_still_matches_when_ocr_amount_and_date_agree():
    known = {"amount": 48.0, "expense_date": date(2026, 11, 3)}
    s1 = fp("s1", RECEIPTS / "s1_ride.jpg", user="employee1").model_copy(update=known)
    s5 = fp("s5", RECEIPTS / "s5_dup.jpg", reim="r5", user="employee2").model_copy(update=known)
    assert find_duplicates(s5, [s1]) is not None


def test_hamming():
    assert hamming("ff00", "ff00") == 0 and hamming("ff00", "ff01") == 1 and hamming("0000", "ffff") == 16
    with pytest.raises(ValueError):
        hamming("ff", "ffff")


def test_phash_none_for_pdf_and_missing(tmp_path):
    pdf = tmp_path / "r.pdf"
    pdf.write_bytes(b"%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n")
    assert phash_file(str(pdf)) is None and phash_file(str(tmp_path / "missing.jpg")) is None
    assert len(sha256_file(str(pdf))) == 64


@pytest.mark.parametrize(
    "extracted, expected",
    [
        ({"total_amount": 48.0, "date": "2026-11-03"}, (48.0, date(2026, 11, 3))),
        ({"total_amount": "48.00", "date": "2026-11-03T10:00:00"}, (48.0, date(2026, 11, 3))),
        ({"total_amount": 0, "date": "Not found in Receipt"}, (None, None)),
        ({"total_amount": "n/a", "date": None}, (None, None)),
        ({"total_amount": float("nan")}, (None, None)),
        ({}, (None, None)),
        (None, (None, None)),
    ],
)
def test_amount_and_date(extracted, expected):
    assert amount_and_date(extracted) == expected
