from datetime import datetime, timedelta, timezone

from engine.services.action_log import GENESIS_HASH, compute_hash, verify_rows

T = datetime(2026, 11, 3, 10, 0, tzinfo=timezone.utc)
ZERO = "0" * 64


def test_compute_hash_is_deterministic_and_key_order_free():
    a = compute_hash(ZERO, "DECISION", "agent", "r1", {"tier": "AUTO_PAY", "score": 5}, T)
    b = compute_hash(ZERO, "DECISION", "agent", "r1", {"score": 5, "tier": "AUTO_PAY"}, T)
    assert a == b and len(a) == 64


def _chain(n):
    rows, prev = [], ZERO
    for i in range(n):
        h = compute_hash(prev, "DECISION", "agent", f"r{i}", {"i": i}, T)
        rows.append({"prev_hash": prev, "hash": h, "action_type": "DECISION", "actor": "agent",
                     "reim_id": f"r{i}", "payload": {"i": i}, "created_at": T})
        prev = h
    return rows


def test_verify_rows_accepts_intact_chain():
    assert verify_rows(_chain(3)) is True


def test_verify_rows_detects_edited_payload():
    rows = _chain(3)
    rows[1]["payload"] = {"i": 99}
    assert verify_rows(rows) is False


def test_verify_rows_detects_deleted_row():
    rows = _chain(3)
    del rows[1]
    assert verify_rows(rows) is False


def test_verify_rows_accepts_empty_log():
    assert verify_rows([]) is True and GENESIS_HASH == ZERO


def test_hash_ignores_the_timezone_the_db_returns():
    # Postgres returns timestamptz in the session time zone; the same instant must hash the same.
    myt = T.astimezone(timezone(timedelta(hours=8)))
    assert compute_hash(ZERO, "DECISION", "agent", None, {}, T) == compute_hash(ZERO, "DECISION", "agent", None, {}, myt)


def test_verify_rows_detects_edited_hash_on_first_row():
    rows = _chain(2)
    rows[0]["prev_hash"] = "f" * 64
    assert verify_rows(rows) is False
