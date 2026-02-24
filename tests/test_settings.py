"""
Tests for the settings store (engine/settings.py) and the /settings API endpoints.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import engine.settings as settings_mod
from engine.api.app import create_app
from engine.settings import DEFAULTS, get_settings, update_settings


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def tmp_settings_file(tmp_path: Path, monkeypatch):
    """
    Redirect the settings store to a fresh temp file for each test.
    Also resets the in-memory cache so each test starts clean.
    """
    fake_file = tmp_path / "settings.json"
    monkeypatch.setattr(settings_mod, "_FILE", fake_file)
    monkeypatch.setattr(settings_mod, "_current", {})
    yield fake_file
    # Reset cache after test so other tests are not affected
    monkeypatch.setattr(settings_mod, "_current", {})


@pytest.fixture(scope="module")
def app():
    return create_app()


@pytest_asyncio.fixture(scope="module")
async def client(app):
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac


# ── Unit tests: settings store ────────────────────────────────────────────────

class TestSettingsDefaults:
    def test_get_settings_returns_all_defaults(self, tmp_settings_file):
        s = get_settings()
        for key, val in DEFAULTS.items():
            assert key in s
            assert s[key] == val

    def test_get_settings_returns_copy(self, tmp_settings_file):
        s1 = get_settings()
        s1["short_break_seconds"] = 9999
        s2 = get_settings()
        assert s2["short_break_seconds"] == DEFAULTS["short_break_seconds"]

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
    def test_update_single_key(self, tmp_settings_file):
        update_settings({"short_break_seconds": 420})
        assert get_settings()["short_break_seconds"] == 420

    def test_update_persists_to_disk(self, tmp_settings_file):
        update_settings({"session_gap_minutes": 15})
        saved = json.loads(tmp_settings_file.read_text())
        assert saved["session_gap_minutes"] == 15

    def test_unknown_keys_are_ignored(self, tmp_settings_file):
        update_settings({"unknown_key": "surprise", "short_break_seconds": 120})
        s = get_settings()
        assert "unknown_key" not in s
        assert s["short_break_seconds"] == 120

    def test_update_coerces_type(self, tmp_settings_file):
        # Pass a float where int is expected — should coerce
        update_settings({"short_break_seconds": 300.9})
        assert isinstance(get_settings()["short_break_seconds"], int)
        assert get_settings()["short_break_seconds"] == 300

    def test_update_returns_full_settings(self, tmp_settings_file):
        result = update_settings({"short_break_seconds": 180})
        assert "long_break_seconds" in result
        assert "high_load_threshold" in result
        assert result["short_break_seconds"] == 180

    def test_partial_update_preserves_other_keys(self, tmp_settings_file):
        update_settings({"high_load_threshold": 0.80})
        s = get_settings()
        assert s["high_load_threshold"] == 0.80
        assert s["fatigue_threshold"] == DEFAULTS["fatigue_threshold"]

    def test_load_from_existing_file(self, tmp_settings_file):
        # Pre-populate the file before any get_settings() call
        tmp_settings_file.write_text(json.dumps({"short_break_seconds": 600}))
        settings_mod._current.clear()
        s = get_settings()
        assert s["short_break_seconds"] == 600
        # Keys not in file fall back to defaults
        assert s["long_break_seconds"] == DEFAULTS["long_break_seconds"]

    def test_malformed_file_falls_back_to_defaults(self, tmp_settings_file):
        tmp_settings_file.write_text("not valid json{{")
        settings_mod._current.clear()
        s = get_settings()
        for key, val in DEFAULTS.items():
            assert s[key] == val


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
