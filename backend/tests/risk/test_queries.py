from datetime import datetime, timedelta, timezone
from uuid import uuid4

from core.models import Reimbursement, SupportingDocument, User
from engine.risk.queries import fingerprint_candidates

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)


def _user(db):
    u = User(email=f"{uuid4()}@example.com", hashed_password="x", name="Test")
    db.add(u)
    db.flush()
    return u


def _claim(db, user, status):
    r = Reimbursement(user_id=user.user_id, main_category="Transportation", currency="MYR",
                      total_claimed_amount=48.0, judgment="APPROVED", summary="", status=status)
    db.add(r)
    db.flush()
    return r


def _doc(db, user, reim, sha, created=NOW, extracted=None):
    d = SupportingDocument(reim_id=reim.reim_id if reim else None, user_id=user.user_id, name="r.jpg",
                           path="/tmp/r.jpg", type="image/jpeg", sha256=sha, phash="c5876bd03ac86a76",
                           extracted_data=extracted or {}, created_at=created)
    db.add(d)
    db.flush()
    return d


def test_candidates_carry_status_and_ocr_fields(pg_db):
    u = _user(pg_db)
    paid = _claim(pg_db, u, "PAID")
    doc = _doc(pg_db, u, paid, "a" * 64, extracted={"total_amount": 48.0, "date": "2026-11-03"})
    [c] = [c for c in fingerprint_candidates(pg_db, None, NOW) if c.document_id == str(doc.document_id)]
    assert c.reim_id == str(paid.reim_id) and c.user_id == str(u.user_id) and c.reim_status == "PAID"
    assert c.amount == 48.0 and c.expense_date.isoformat() == "2026-11-03" and c.phash == "c5876bd03ac86a76"


def test_candidates_filter_claim_window_and_unhashed(pg_db):
    u = _user(pg_db)
    current, other = _claim(pg_db, u, "PENDING"), _claim(pg_db, u, "REJECTED")
    in_current = _doc(pg_db, u, current, "b" * 64)
    in_other = _doc(pg_db, u, other, "c" * 64)
    unattached = _doc(pg_db, u, None, "d" * 64)
    too_old = _doc(pg_db, u, other, "e" * 64, created=NOW - timedelta(days=181))
    unhashed = _doc(pg_db, u, other, None)
    ids = {c.document_id for c in fingerprint_candidates(pg_db, str(current.reim_id), NOW)}
    assert str(in_other.document_id) in ids and str(unattached.document_id) in ids
    assert not ids & {str(in_current.document_id), str(too_old.document_id), str(unhashed.document_id)}
