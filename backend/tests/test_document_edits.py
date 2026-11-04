from core.models import SupportingDocument
from tests.test_approvals_api import env  # noqa: F401


def test_edit_response_does_not_tell_the_employee_an_edit_was_flagged(env):  # noqa: F811
    c, db, users, act_as = env
    doc = SupportingDocument(user_id=users["emp"].user_id, name="r.jpg", path="/storage/r.jpg", type="image",
                             extracted_data={"total_amount": 5.8})
    db.add(doc)
    db.commit()
    act_as("emp")

    for res in (c.post(f"/api/v1/documents/{doc.document_id}/edits", json={"total_amount": 58.0}),
                c.patch(f"/api/v1/documents/{doc.document_id}/fields", json={"edits": {"total_amount": 580.0}})):
        assert res.status_code == 200
        assert set(res.json()) == {"document_id", "human_edited", "change_count"}
