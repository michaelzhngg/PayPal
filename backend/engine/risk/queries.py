"""DB reads for the shield. The only module under engine/risk that touches the database."""

from datetime import datetime, timedelta

from sqlmodel import Session, select

from core.models import Reimbursement, SupportingDocument
from engine.risk.shield.fingerprint import amount_and_date
from engine.risk.types import DocFingerprint


def fingerprint_candidates(
    db: Session, exclude_reim_id: str | None, now: datetime, days: int = 180
) -> list[DocFingerprint]:
    """Fingerprinted documents uploaded in the last `days`, with their claim's status.

    Documents of `exclude_reim_id` are left out; the caller compares a claim's own documents itself.
    """
    stmt = (
        select(SupportingDocument, Reimbursement.status)
        .join(Reimbursement, Reimbursement.reim_id == SupportingDocument.reim_id, isouter=True)
        .where(SupportingDocument.sha256.is_not(None))
        .where(SupportingDocument.created_at >= now - timedelta(days=days))
    )
    if exclude_reim_id is not None:
        stmt = stmt.where(
            (SupportingDocument.reim_id.is_(None)) | (SupportingDocument.reim_id != exclude_reim_id)
        )
    out = []
    for doc, status in db.exec(stmt).all():
        amount, expense_date = amount_and_date(doc.extracted_data)
        out.append(
            DocFingerprint(
                document_id=str(doc.document_id),
                reim_id=str(doc.reim_id) if doc.reim_id else None,
                user_id=str(doc.user_id),
                sha256=doc.sha256,
                phash=doc.phash,
                reim_status=getattr(status, "value", status),
                amount=amount,
                expense_date=expense_date,
            )
        )
    return out
