import asyncio
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import deps, reimbursements
from core.enums import UserRole
from core.models import User
from engine.progress import ProgressTracker

COMPLETE = 'event: complete\ndata: {"reimbursements": []}\n\n'


def _user(role=UserRole.Employee):
    return User(user_id=uuid4(), email=f"{uuid4().hex[:8]}@test.local", hashed_password="x", name="u", role=role)


@pytest.fixture
def stream():
    owner = _user()
    db = MagicMock()
    app = FastAPI()
    app.include_router(reimbursements.router, prefix="/reimbursements")
    app.dependency_overrides[deps.get_db] = lambda: db

    async def make_task():
        task_id = ProgressTracker.create_task(owner_id=owner.user_id)
        ProgressTracker._queues[task_id].queue.put_nowait(COMPLETE)
        return task_id

    task_id = asyncio.run(make_task())

    def get(as_user=None):
        if as_user is not None:
            app.dependency_overrides[deps.get_current_user] = lambda: as_user
        return TestClient(app).get(f"/reimbursements/analyze/progress/{task_id}")

    yield get, owner, db
    ProgressTracker._queues.pop(task_id, None)


def test_stream_requires_a_session(stream):
    get, _, _ = stream
    assert get().status_code == 401


def test_stream_refuses_other_users_and_keeps_the_task_alive(stream):
    get, owner, _ = stream
    assert get(_user()).status_code == 403
    assert get(_user(UserRole.HR)).status_code == 403

    res = get(owner)
    assert res.status_code == 200 and "event: complete" in res.text


def test_stream_releases_its_db_connection(stream):
    get, owner, db = stream
    assert get(owner).status_code == 200
    db.close.assert_called()
