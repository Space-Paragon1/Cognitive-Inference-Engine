"""
Per-user isolation: each account has its own engine, timeline, tasks and focus state.
"""

from __future__ import annotations

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from tests.conftest import make_user_token


@pytest_asyncio.fixture(scope="module")
async def env(app):
    async with app.router.lifespan_context(app):
        a = {"Authorization": f"Bearer {make_user_token(app, 'alice@example.com')}"}
        b = {"Authorization": f"Bearer {make_user_token(app, 'bob@example.com')}"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield app, ac, a, b


def _user_id(app, email):
    return app.state.users_db.get_by_email(email).id


class TestEngineIsolation:
    async def test_telemetry_only_reaches_the_sender(self, env):
        app, ac, a, _ = env
        events = [{"source": "browser", "type": "TAB_SWITCH", "data": {}}] * 20
        await ac.post("/telemetry/batch", json=events, headers=a)

        registry = app.state.engines
        alice = registry.get(_user_id(app, "alice@example.com"))
        bob = registry.get(_user_id(app, "bob@example.com"))
        alice.aggregator.tick()
        bob.aggregator.tick()

        assert alice.aggregator.current_state()["active"] is True
        assert bob.aggregator.current_state()["active"] is False
        assert bob.aggregator.current_state()["context"] == "unknown"

    async def test_timeline_is_scoped_to_user(self, env):
        app, ac, a, b = env
        await ac.post(
            "/telemetry/event", json={"source": "browser", "type": "TAB_SWITCH", "data": {}},
            headers=a,
        )
        app.state.engines.get(_user_id(app, "alice@example.com")).aggregator.tick()

        alice_rows = (await ac.get("/timeline", headers=a)).json()
        bob_rows = (await ac.get("/timeline", headers=b)).json()
        assert len(alice_rows) >= 1
        assert bob_rows == []
        assert (await ac.get("/timeline/load-history", headers=b)).json()["count"] == 0

    async def test_tasks_are_per_user(self, env):
        _, ac, a, b = env
        await ac.post(
            "/actions/tasks",
            json={"id": "alice-only", "title": "Alice's task", "difficulty": "easy"},
            headers=a,
        )
        bob_ids = [t["id"] for t in (await ac.get("/actions/tasks", headers=b)).json()["tasks"]]
        assert "alice-only" not in bob_ids
        assert (await ac.delete("/actions/tasks/alice-only", headers=b)).status_code == 404

    async def test_focus_is_per_user(self, env):
        _, ac, a, b = env
        await ac.post("/actions/focus/start", json={"duration_minutes": 5}, headers=a)
        assert (await ac.get("/actions/focus", headers=a)).json()["active"] is True
        assert (await ac.get("/actions/focus", headers=b)).json()["active"] is False
        await ac.post("/actions/focus/stop", headers=a)


class TestPersistenceAndEviction:
    async def test_tasks_survive_engine_eviction(self, env):
        app, ac, a, _ = env
        await ac.post(
            "/actions/tasks",
            json={"id": "persist-me", "title": "Survives", "difficulty": "hard"},
            headers=a,
        )
        registry = app.state.engines
        uid = _user_id(app, "alice@example.com")
        registry.get(uid).focus.deactivate()
        registry.get(uid).pomodoro.reset()
        assert registry.evict_idle(now=10**12) >= 1
        assert registry.peek(uid) is None

        ids = [t["id"] for t in (await ac.get("/actions/tasks", headers=a)).json()["tasks"]]
        assert "persist-me" in ids

    async def test_busy_engines_are_not_evicted(self, env):
        app, ac, a, _ = env
        uid = _user_id(app, "alice@example.com")
        await ac.post("/actions/pomodoro/start", headers=a)
        app.state.engines.evict_idle(now=10**12)
        assert app.state.engines.peek(uid) is not None
        await ac.post("/actions/pomodoro/stop", headers=a)

    async def test_task_upsert_is_idempotent(self, env):
        _, ac, a, _ = env
        body = {"id": "dup", "title": "v1", "difficulty": "easy"}
        await ac.post("/actions/tasks", json=body, headers=a)
        await ac.post("/actions/tasks", json={**body, "title": "v2"}, headers=a)
        tasks = [t for t in (await ac.get("/actions/tasks", headers=a)).json()["tasks"]
                 if t["id"] == "dup"]
        assert len(tasks) == 1 and tasks[0]["title"] == "v2"


class TestBatchLimits:
    async def test_oversized_batch_rejected(self, env):
        _, ac, a, _ = env
        events = [{"source": "browser", "type": "TAB_SWITCH", "data": {}}] * 501
        r = await ac.post("/telemetry/batch", json=events, headers=a)
        assert r.status_code == 422
