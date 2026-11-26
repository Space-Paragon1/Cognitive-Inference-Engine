"""
Tests for the per-user settings store (engine/settings.py) and the /settings API.
"""

from __future__ import annotations

import json

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine

from engine.api.app import create_app
from engine.db.connection import metadata, user_settings_table
from engine.settings import DEFAULTS, SettingsStore
from tests.conftest import make_user_token

# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture()
def store():
    """A SettingsStore backed by a fresh in-memory SQLite database."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    metadata.create_all(engine)
    return SettingsStore(engine)


@pytest.fixture(scope="module")
def app():
    return create_app()


@pytest_asyncio.fixture(scope="module")
async def client(app):
    async with app.router.lifespan_context(app):
        token = make_user_token(app, "settings-test@example.com")
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {token}"},
        ) as ac:
            yield ac


# ── Unit tests: settings store ────────────────────────────────────────────────

class TestSettingsDefaults:
    def test_new_user_gets_all_defaults(self, store):
        s = store.get(1)
        for key, val in DEFAULTS.items():
            assert s[key] == val

    def test_get_returns_copy(self, store):
        s1 = store.get(1)
        s1["short_break_seconds"] = 9999
        assert store.get(1)["short_break_seconds"] == DEFAULTS["short_break_seconds"]

    def test_defaults_contain_expected_keys(self):
        expected = {
            "short_break_seconds",
            "long_break_seconds",
            "high_load_threshold",
            "fatigue_threshold",
            "session_gap_minutes",
        }
        assert set(DEFAULTS.keys()) == expected


class TestUpdateSettings:
    def test_update_single_key(self, store):
        store.update(1, {"short_break_seconds": 420})
        assert store.get(1)["short_break_seconds"] == 420

    def test_update_persists_to_database(self, store):
        store.update(1, {"session_gap_minutes": 15})
        # A second store on the same database has no cache, so it reads the row.
        fresh = SettingsStore(store._engine)
        assert fresh.get(1)["session_gap_minutes"] == 15

    def test_users_are_isolated(self, store):
        store.update(1, {"session_gap_minutes": 15})
        store.update(2, {"session_gap_minutes": 30})
        assert store.get(1)["session_gap_minutes"] == 15
        assert store.get(2)["session_gap_minutes"] == 30
        assert store.get(3)["session_gap_minutes"] == DEFAULTS["session_gap_minutes"]

    def test_unknown_keys_are_ignored(self, store):
        store.update(1, {"unknown_key": "surprise", "short_break_seconds": 120})
        s = store.get(1)
        assert "unknown_key" not in s
        assert s["short_break_seconds"] == 120

    def test_update_coerces_type(self, store):
        store.update(1, {"short_break_seconds": 300.9})
        assert isinstance(store.get(1)["short_break_seconds"], int)
        assert store.get(1)["short_break_seconds"] == 300

    def test_update_returns_full_settings(self, store):
        result = store.update(1, {"short_break_seconds": 180})
        assert "long_break_seconds" in result
        assert "high_load_threshold" in result
        assert result["short_break_seconds"] == 180

    def test_partial_update_preserves_other_keys(self, store):
        store.update(1, {"high_load_threshold": 0.80})
        s = store.get(1)
        assert s["high_load_threshold"] == 0.80
        assert s["fatigue_threshold"] == DEFAULTS["fatigue_threshold"]

    def test_malformed_row_falls_back_to_defaults(self, store):
        with store._engine.begin() as conn:
            conn.execute(
                user_settings_table.insert().values(
                    user_id=7, settings_json="not valid json{{", updated_at=0.0
                )
            )
        s = store.get(7)
        for key, val in DEFAULTS.items():
            assert s[key] == val

    def test_stored_row_is_json(self, store):
        store.update(1, {"short_break_seconds": 600})
        with store._engine.connect() as conn:
            row = conn.execute(user_settings_table.select()).fetchone()
        assert json.loads(row.settings_json)["short_break_seconds"] == 600


# ── API integration tests: GET /settings ─────────────────────────────────────

class TestSettingsGetEndpoint:
    async def test_get_settings_returns_200(self, client):
        r = await client.get("/settings")
        assert r.status_code == 200

    async def test_get_settings_response_shape(self, client):
        r = await client.get("/settings")
        body = r.json()
        assert "settings" in body
        assert "defaults" in body

    async def test_get_settings_contains_all_keys(self, client):
        r = await client.get("/settings")
        s = r.json()["settings"]
        for key in DEFAULTS:
            assert key in s

    async def test_get_defaults_match_module_defaults(self, client):
        r = await client.get("/settings")
        returned_defaults = r.json()["defaults"]
        for key, val in DEFAULTS.items():
            assert returned_defaults[key] == val

    async def test_settings_values_are_in_valid_range(self, client):
        r = await client.get("/settings")
        s = r.json()["settings"]
        assert 60 <= s["short_break_seconds"] <= 3600
        assert 300 <= s["long_break_seconds"] <= 3600
        assert 0.4 <= s["high_load_threshold"] <= 0.99
        assert 0.4 <= s["fatigue_threshold"] <= 0.99
        assert 1 <= s["session_gap_minutes"] <= 60


# ── API integration tests: PUT /settings ─────────────────────────────────────

class TestSettingsPutEndpoint:
    async def test_put_updates_short_break(self, client):
        r = await client.put("/settings", json={"short_break_seconds": 240})
        assert r.status_code == 200
        assert r.json()["settings"]["short_break_seconds"] == 240

    async def test_put_updates_multiple_keys(self, client):
        r = await client.put("/settings", json={
            "high_load_threshold": 0.70,
            "fatigue_threshold": 0.90,
        })
        assert r.status_code == 200
        s = r.json()["settings"]
        assert s["high_load_threshold"] == pytest.approx(0.70)
        assert s["fatigue_threshold"] == pytest.approx(0.90)

    async def test_put_partial_patch_preserves_other_keys(self, client):
        # First set a known value
        await client.put("/settings", json={"session_gap_minutes": 8})
        # Then patch only another key
        r = await client.put("/settings", json={"short_break_seconds": 300})
        assert r.status_code == 200
        s = r.json()["settings"]
        assert s["session_gap_minutes"] == 8

    async def test_put_response_contains_settings_key(self, client):
        r = await client.put("/settings", json={"session_gap_minutes": 5})
        assert r.status_code == 200
        assert "settings" in r.json()

    async def test_put_empty_body_returns_200(self, client):
        """Empty patch is valid — a no-op."""
        r = await client.put("/settings", json={})
        assert r.status_code == 200

    async def test_put_short_break_below_minimum_returns_422(self, client):
        r = await client.put("/settings", json={"short_break_seconds": 30})  # min=60
        assert r.status_code == 422

    async def test_put_short_break_above_maximum_returns_422(self, client):
        r = await client.put("/settings", json={"short_break_seconds": 9999})  # max=900
        assert r.status_code == 422

    async def test_put_long_break_below_minimum_returns_422(self, client):
        r = await client.put("/settings", json={"long_break_seconds": 60})  # min=300
        assert r.status_code == 422

    async def test_put_long_break_above_maximum_returns_422(self, client):
        r = await client.put("/settings", json={"long_break_seconds": 7200})  # max=3600
        assert r.status_code == 422

    async def test_put_high_load_threshold_below_minimum_returns_422(self, client):
        r = await client.put("/settings", json={"high_load_threshold": 0.2})  # min=0.4
        assert r.status_code == 422

    async def test_put_high_load_threshold_above_maximum_returns_422(self, client):
        r = await client.put("/settings", json={"high_load_threshold": 0.99})  # max=0.95
        assert r.status_code == 422

    async def test_put_fatigue_threshold_below_minimum_returns_422(self, client):
        r = await client.put("/settings", json={"fatigue_threshold": 0.1})  # min=0.5
        assert r.status_code == 422

    async def test_put_session_gap_below_minimum_returns_422(self, client):
        r = await client.put("/settings", json={"session_gap_minutes": 1})  # min=2
        assert r.status_code == 422

    async def test_put_session_gap_above_maximum_returns_422(self, client):
        r = await client.put("/settings", json={"session_gap_minutes": 100})  # max=60
        assert r.status_code == 422

    async def test_get_reflects_put(self, client):
        """A value written via PUT should be visible in a subsequent GET."""
        await client.put("/settings", json={"session_gap_minutes": 12})
        r = await client.get("/settings")
        assert r.json()["settings"]["session_gap_minutes"] == 12

    async def test_fatigue_must_exceed_high_load(self, client):
        r = await client.put("/settings", json={
            "high_load_threshold": 0.80,
            "fatigue_threshold": 0.75,
        })
        assert r.status_code == 422


class TestSettingsPerUser:
    async def test_other_users_settings_are_not_visible(self, app, client):
        await client.put("/settings", json={"session_gap_minutes": 33})
        other = make_user_token(app, "settings-other@example.com")
        r = await client.get("/settings", headers={"Authorization": f"Bearer {other}"})
        assert r.json()["settings"]["session_gap_minutes"] == DEFAULTS["session_gap_minutes"]
