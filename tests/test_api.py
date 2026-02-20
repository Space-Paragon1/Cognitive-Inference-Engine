"""
Integration tests for the FastAPI application.
Uses httpx.AsyncClient with the ASGI transport (no running server needed).
Fixtures are provided by tests/conftest.py.
"""

from __future__ import annotations

import pytest


class TestHealth:
    async def test_health_ok(self, client):
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestStateEndpoint:
    async def test_state_returns_valid_schema(self, client):
        r = await client.get("/state")
        assert r.status_code == 200
        body = r.json()
        assert "load_score" in body
        assert "context" in body
        assert "confidence" in body
        assert "breakdown" in body
        assert 0.0 <= body["load_score"] <= 1.0

    async def test_state_breakdown_has_three_components(self, client):
        r = await client.get("/state")
        b = r.json()["breakdown"]
        assert "intrinsic" in b
        assert "extraneous" in b
        assert "germane" in b


class TestTelemetryEndpoint:
    async def test_ingest_browser_tab_switch(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "browser",
            "type": "TAB_SWITCH",
            "data": {"fromUrl": "https://reddit.com", "toUrl": "https://arxiv.org"},
        })
        assert r.status_code == 202

    async def test_ingest_ide_compile_error(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "ide",
            "type": "COMPILE_ERROR",
            "data": {"errorCount": 2, "language": "python"},
        })
        assert r.status_code == 202

    async def test_unknown_source_returns_400(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "toaster",
            "type": "TAB_SWITCH",
            "data": {},
        })
        assert r.status_code == 400

    async def test_unknown_event_type_returns_422(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "browser",
            "type": "MADE_UP_EVENT",
            "data": {},
        })
        assert r.status_code == 422

    async def test_batch_ingest(self, client):
        r = await client.post("/telemetry/batch", json=[
            {"source": "browser", "type": "TAB_SWITCH", "data": {}},
            {"source": "ide", "type": "KEYSTROKE", "data": {"intervalMs": 80}},
            {"source": "desktop", "type": "WINDOW_FOCUS", "data": {"app": "VSCode"}},
        ])
        assert r.status_code == 202
        body = r.json()
        assert body["accepted"] == 3
        assert body["total"] == 3


class TestActionsEndpoints:
    async def test_focus_start_and_stop(self, client):
        # Start
        r = await client.post("/actions/focus/start", json={
            "duration_minutes": 10,
            "block_tabs": True,
            "reason": "test",
        })
        assert r.status_code == 200
        assert r.json()["active"] is True

        # Stop
        r = await client.post("/actions/focus/stop")
        assert r.status_code == 200
        assert r.json()["active"] is False

    async def test_focus_get(self, client):
        r = await client.get("/actions/focus")
        assert r.status_code == 200
        assert "active" in r.json()

    async def test_task_add_and_list(self, client):
        r = await client.post("/actions/tasks", json={
            "id": "test-task-1",
            "title": "Write unit tests",
            "difficulty": "medium",
            "estimated_minutes": 30,
            "tags": ["testing"],
        })
        assert r.status_code == 201
        assert r.json()["id"] == "test-task-1"

        r = await client.get("/actions/tasks")
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()["tasks"]]
        assert "test-task-1" in ids

    async def test_task_delete(self, client):
        # Add then delete
        await client.post("/actions/tasks", json={
            "id": "delete-me",
            "title": "Temp task",
            "difficulty": "easy",
            "estimated_minutes": 5,
        })
        r = await client.delete("/actions/tasks/delete-me")
        assert r.status_code == 200

    async def test_task_delete_not_found(self, client):
        r = await client.delete("/actions/tasks/nonexistent-xyz")
        assert r.status_code == 404

    async def test_directives_endpoint(self, client):
        r = await client.get("/actions/directives")
        assert r.status_code == 200
        assert "directives" in r.json()

    async def test_pomodoro_get(self, client):
        r = await client.get("/actions/pomodoro")
        assert r.status_code == 200
        assert "phase" in r.json()
        assert "remaining_seconds" in r.json()


class TestTimelineEndpoint:
    async def test_timeline_query_returns_list(self, client):
        r = await client.get("/timeline")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_load_history_returns_scores(self, client):
        r = await client.get("/timeline/load-history?window_s=60")
        assert r.status_code == 200
        body = r.json()
        assert "scores" in body
        assert isinstance(body["scores"], list)
