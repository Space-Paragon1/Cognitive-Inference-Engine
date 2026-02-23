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


class TestLMSTelemetry:
    async def test_lms_assignment_view_accepted(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "lms",
            "type": "ASSIGNMENT_VIEW",
            "data": {"lms": "canvas", "course": "CS 101", "title": "Week 3 Quiz"},
        })
        assert r.status_code == 202

    async def test_lms_quiz_fail_accepted(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "lms",
            "type": "QUIZ_FAIL",
            "data": {"lms": "canvas", "course": "CS 101"},
        })
        assert r.status_code == 202

    async def test_lms_submission_late_accepted(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "lms",
            "type": "SUBMISSION_LATE",
            "data": {"lms": "blackboard", "course": "MATH 201"},
        })
        assert r.status_code == 202

    async def test_lms_scroll_accepted(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "lms",
            "type": "LMS_SCROLL",
            "data": {"lms": "moodle", "course": "ENG 110", "deltaY": 800},
        })
        assert r.status_code == 202

    async def test_lms_idle_accepted(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "lms",
            "type": "LMS_IDLE",
            "data": {"lms": "canvas", "course": "CS 101"},
        })
        assert r.status_code == 202

    async def test_lms_unknown_event_returns_422(self, client):
        r = await client.post("/telemetry/event", json={
            "source": "lms",
            "type": "TOTALLY_UNKNOWN",
            "data": {},
        })
        assert r.status_code == 422

    async def test_lms_batch_ingest(self, client):
        r = await client.post("/telemetry/batch", json=[
            {"source": "lms", "type": "QUIZ_START", "data": {"lms": "canvas", "course": "CS 101"}},
            {"source": "lms", "type": "LMS_SCROLL", "data": {"lms": "canvas", "course": "CS 101", "deltaY": 500}},
            {"source": "lms", "type": "COURSE_NAVIGATE", "data": {"lms": "canvas", "course": "CS 101"}},
        ])
        assert r.status_code == 202
        body = r.json()
        assert body["accepted"] == 3
        assert body["total"] == 3

    async def test_lms_mixed_batch(self, client):
        """Mix of LMS + browser events in one batch."""
        r = await client.post("/telemetry/batch", json=[
            {"source": "lms", "type": "ASSIGNMENT_VIEW", "data": {"lms": "canvas", "course": "CS 101"}},
            {"source": "browser", "type": "TAB_SWITCH", "data": {"fromUrl": "https://canvas.edu", "toUrl": "https://stackoverflow.com"}},
        ])
        assert r.status_code == 202
        assert r.json()["accepted"] == 2


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

    async def test_sessions_returns_list(self, client):
        r = await client.get("/timeline/sessions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_sessions_schema(self, client):
        """Sessions endpoint returns the expected schema even when empty."""
        r = await client.get("/timeline/sessions")
        assert r.status_code == 200
        sessions = r.json()
        if sessions:
            s = sessions[0]
            assert "start_ts" in s
            assert "end_ts" in s
            assert "duration_minutes" in s
            assert "avg_load_score" in s
            assert "dominant_context" in s
            assert "context_distribution" in s

    async def test_daily_stats_returns_list(self, client):
        r = await client.get("/timeline/stats/daily")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_daily_stats_schema(self, client):
        """Daily stats endpoint returns correct schema when data exists."""
        r = await client.get("/timeline/stats/daily")
        assert r.status_code == 200
        stats = r.json()
        if stats:
            d = stats[0]
            assert "date" in d
            assert "tick_count" in d
            assert "session_count" in d
            assert "avg_load_score" in d
            assert "focus_minutes" in d

    async def test_timeline_source_filter(self, client):
        """Filtering by source returns only that source."""
        r = await client.get("/timeline?source=engine&limit=50")
        assert r.status_code == 200
        entries = r.json()
        for e in entries:
            assert e["source"] == "engine"
