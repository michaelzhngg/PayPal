"""Shield and decide() against Postgres with the real autonomy store and action log. Needs TEST_DATABASE_URL."""
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from sqlmodel import select

import engine.agents.compliance_agent as ca
from core.enums import AgentActionType, ReimbursementStatus, UserRole
from core.models import AgentAction, LineItem, Policy, Reimbursement, SettlementReceipt, SupportingDocument, TravelSettlement, User
from engine.agents.document_agent import _fingerprint
from engine.risk.queries import recent_claims

RECEIPTS = Path(__file__).resolve().parents[2] / "demo" / "receipts"
S1_OCR = {"merchant_name": "Lintas Teksi Bandar", "date": "2026-11-03", "total_amount": 48.0,
          "line_items": [{"description": "Fare", "amount": 45.0}, {"description": "Booking fee", "amount": 3.0}],
          "visible_text": "LINTAS TEKSI BANDAR Fare 45.00 Booking fee 3.00 TOTAL 48.00"}


@pytest.fixture
def db(pg_db):
    # Rolled back with the test: other suites' fingerprints and breaker state must not leak in.
    from sqlalchemy import text
    pg_db.exec(text("UPDATE supporting_documents SET sha256 = NULL, phash = NULL"))
    pg_db.exec(text("UPDATE autonomy_settings SET breaker_until = NULL, enabled = true"))
    return pg_db


def employee(db, name="aisyah"):
    u = User(email=f"{name}-{uuid4().hex[:8]}@test.local", hashed_password="x", name=name, role=UserRole.Employee,
             paypal_payer_id=f"PAYER{uuid4().hex[:6]}", paypal_email=f"{name}@gmail.com", paypal_verified=True,
             paypal_linked_at=datetime.now(timezone.utc) - timedelta(days=30))
    db.add(u)
    db.flush()
    # Three paid claims make the employee STANDARD (RM100 limit), like the demo accounts.
    for _ in range(3):
        db.add(Reimbursement(user_id=u.user_id, main_category="Transportation", currency="MYR", judgment="APPROVED",
                             total_claimed_amount=20.0, status=ReimbursementStatus.PAID, summary=""))
    db.flush()
    return u


def policy(db, owner):
    p = Policy(alias=f"T-{uuid4().hex[:8]}", title="Test policy", effective_date=datetime.now(timezone.utc),
               overview_summary="", mandatory_conditions="{}", source_file_url="", status="ACTIVE", created_by=owner.user_id)
    db.add(p)
    db.flush()
    return p


def upload(db, user, filename, ocr=None):
    settlement = TravelSettlement(user_id=user.user_id, currency="MYR", total_claimed_amount=48.0)
    db.add(settlement)
    db.flush()
    doc = SupportingDocument(user_id=user.user_id, name=filename, path=f"/storage/{filename}", type="image",
                             extracted_data=ocr or S1_OCR, settlement_id=settlement.settlement_id)
    db.add(doc)
    db.flush()
    _fingerprint(doc, str(RECEIPTS / filename), "image")
    db.add(SettlementReceipt(settlement_id=settlement.settlement_id, document_id=doc.document_id,
                             merchant_name="Lintas Teksi Bandar", receipt_date=date(2026, 11, 3),
                             category="Transportation", claimed_amount=48.0, currency="MYR"))
    db.flush()
    return settlement, doc


def state_for(user, pol, settlement, docs, amount=48.0):
    receipts = [{"document_id": str(d.document_id), "date": "2026-11-03", "category": "Transportation",
                 "merchant_name": "Lintas Teksi Bandar", "total_amount": amount / len(docs), "currency": "MYR"}
                for d in docs]
    lines = [{"document_id": r["document_id"], "category": "Transportation", "description": "Ride", "status": "APPROVED",
              "requested_amount": r["total_amount"], "approved_amount": r["total_amount"]} for r in receipts]
    return {
        "settlement_id": str(settlement.settlement_id), "policy_id": str(pol.policy_id), "main_category": "Transportation",
        "user_id": str(user.user_id), "all_category": ["Transportation"], "document_ids": [], "reim_id": str(uuid4()),
        "user": user, "policy": pol, "receipts": receipts, "combined_conditions": [], "currency": "MYR",
        "line_items": lines,
        "totals": {"total_requested": amount, "net_approved": amount, "total_deduction": 0, "by_category": {}},
        "judgment": "APPROVED", "confidence": 0.95, "summary": "", "signals": [], "reimbursement_id": "",
    }


def run(db, state):
    steps = []
    state["signals"] = ca.receipt_shield(state, db, emit=steps.append)["signals"]
    out = ca.save_reimbursement(state, db, emit=steps.append)
    return db.get(Reimbursement, out["reimbursement_id"]), steps


def test_upload_fingerprints_images_and_pdfs(tmp_path):
    img = SupportingDocument(user_id=uuid4(), name="s5", path="x", type="image")
    _fingerprint(img, str(RECEIPTS / "s5_dup.jpg"), "image")
    assert len(img.sha256) == 64 and len(img.phash) == 16
    assert [s["code"] for s in img.shield["provenance"]] == ["NO_CAMERA_METADATA"]
    pdf_path = tmp_path / "r.pdf"
    pdf_path.write_bytes(b"%PDF-1.4 receipt")
    pdf = SupportingDocument(user_id=uuid4(), name="r", path="x", type="pdf")
    _fingerprint(pdf, str(pdf_path), "pdf")
    assert pdf.sha256 and pdf.phash is None and pdf.shield == {}


def test_s1_is_auto_paid_logged_and_linked(db):
    user = employee(db)
    pol = policy(db, user)
    settlement, doc = upload(db, user, "s1_ride.jpg")
    reim, steps = run(db, state_for(user, pol, settlement, [doc]))
    assert reim.tier == "AUTO_PAY" and reim.status == ReimbursementStatus.APPROVED and reim.risk_score == 0
    assert reim.autonomy["tier"] == "AUTO_PAY" and reim.autonomy["hard_stops"] == []
    action = db.exec(select(AgentAction).where(AgentAction.reim_id == reim.reim_id)).one()
    assert action.action_type == AgentActionType.DECISION.value and action.payload["tier"] == "AUTO_PAY"
    db.refresh(doc)
    assert doc.reim_id == reim.reim_id
    assert {s.step: s.status for s in steps if s.status != "running"}["shield.duplicate"] == "done"


def test_same_image_twice_in_one_claim_goes_to_dual_review(db):
    user = employee(db)
    pol = policy(db, user)
    settlement, first = upload(db, user, "s1_ride.jpg")
    second = SupportingDocument(user_id=user.user_id, name="copy.jpg", path="/storage/copy.jpg", type="image",
                                extracted_data=S1_OCR, settlement_id=settlement.settlement_id)
    db.add(second)
    db.flush()
    _fingerprint(second, str(RECEIPTS / "s1_ride.jpg"), "image")
    reim, _ = run(db, state_for(user, pol, settlement, [first, second]))
    dups = [s for s in reim.autonomy["signals"] if s["code"] == "DUPLICATE_RECEIPT"]
    assert reim.tier == "DUAL_REVIEW" and len(dups) == 2
    assert all(m["same_claim"] for s in dups for m in s["evidence"]["matches"])


def test_s5_duplicate_of_another_employees_paid_s1(db):
    first_user, second_user = employee(db, "aisyah"), employee(db, "farid")
    pol = policy(db, first_user)
    s1_settlement, s1_doc = upload(db, first_user, "s1_ride.jpg")
    s1, _ = run(db, state_for(first_user, pol, s1_settlement, [s1_doc]))
    s1.status = ReimbursementStatus.PAID
    db.add(s1)
    db.flush()

    s5_settlement, s5_doc = upload(db, second_user, "s5_dup.jpg")
    s5, _ = run(db, state_for(second_user, pol, s5_settlement, [s5_doc]))
    assert s5.tier == "DUAL_REVIEW" and s5.risk_score == 55
    [dup] = [s for s in s5.autonomy["signals"] if s["code"] == "DUPLICATE_RECEIPT"]
    [match] = dup["evidence"]["matches"]
    assert match["reim_id"] == str(s1.reim_id) and match["reim_status"] == "PAID" and match["same_user"] is False


def test_recent_claims_reads_merchant_and_date_from_the_receipts(db):
    user = employee(db)
    pol = policy(db, user)
    settlement, doc = upload(db, user, "s1_ride.jpg")
    reim, _ = run(db, state_for(user, pol, settlement, [doc]))
    [lite] = [c for c in recent_claims(db, user.user_id, datetime.now(timezone.utc)) if c.reim_id == str(reim.reim_id)]
    assert lite.reim_id == str(reim.reim_id) and lite.merchant == "Lintas Teksi Bandar"
    assert lite.expense_date == date(2026, 11, 3) and lite.amount == 48.0 and lite.status == "APPROVED"
    assert db.exec(select(LineItem).where(LineItem.reim_id == reim.reim_id)).first().document_id == doc.document_id
