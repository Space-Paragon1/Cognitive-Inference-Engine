"""
Device pairing: pairing codes, device tokens, and what device tokens may do.
"""

from __future__ import annotations

import time

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from engine.db.connection import device_tokens_table, pairing_codes_table
from tests.conftest import make_user_token


@pytest_asyncio.fixture(scope="module")
async def env(app):
    """Lifespan + an anonymous client + a signed-in user's auth header."""
    async with app.router.lifespan_context(app):
        token = make_user_token(app, "devices@example.com")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac, {"Authorization": f"Bearer {token}"}


async def _pair(ac, user_headers, name="Chrome on test", kind="browser"):
    r = await ac.post("/devices/pairing-code", headers=user_headers)
    assert r.status_code == 201
    code = r.json()["code"]
    r = await ac.post("/devices/claim", json={"code": code, "name": name, "kind": kind})
    assert r.status_code == 201, r.text
    return r.json()


class TestPairing:
    async def test_pairing_code_requires_login(self, env):
        ac, _ = env
        r = await ac.post("/devices/pairing-code")
        assert r.status_code == 401

    async def test_pairing_code_shape(self, env):
        ac, user = env
        r = await ac.post("/devices/pairing-code", headers=user)
        body = r.json()
        assert len(body["code"]) == 9 and body["code"][4] == "-"
        assert body["expires_at"] > time.time()

    async def test_claim_returns_device_token(self, env):
        ac, user = env
        body = await _pair(ac, user)
        assert body["device_token"].startswith("clr_dev_")
        assert body["device"]["kind"] == "browser"
        assert body["user_email"] == "devices@example.com"

    async def test_code_is_case_and_hyphen_insensitive(self, env):
        ac, user = env
        code = (await ac.post("/devices/pairing-code", headers=user)).json()["code"]
        messy = code.replace("-", " ").lower()
        r = await ac.post("/devices/claim", json={"code": messy, "name": "x", "kind": "ide"})
        assert r.status_code == 201

    async def test_code_is_single_use(self, env):
        ac, user = env
        code = (await ac.post("/devices/pairing-code", headers=user)).json()["code"]
        r1 = await ac.post("/devices/claim", json={"code": code, "name": "a", "kind": "ide"})
        r2 = await ac.post("/devices/claim", json={"code": code, "name": "b", "kind": "ide"})
        assert r1.status_code == 201
        assert r2.status_code == 400

    async def test_new_code_replaces_old(self, env):
        ac, user = env
        old = (await ac.post("/devices/pairing-code", headers=user)).json()["code"]
        await ac.post("/devices/pairing-code", headers=user)
        r = await ac.post("/devices/claim", json={"code": old, "name": "a", "kind": "ide"})
        assert r.status_code == 400

    async def test_expired_code_rejected(self, app, env):
        ac, user = env
        code = (await ac.post("/devices/pairing-code", headers=user)).json()["code"]
        with app.state.db_engine.begin() as conn:
            conn.execute(pairing_codes_table.update().values(expires_at=time.time() - 1))
        r = await ac.post("/devices/claim", json={"code": code, "name": "a", "kind": "ide"})
        assert r.status_code == 400

    async def test_unknown_code_rejected(self, env):
        ac, _ = env
        r = await ac.post("/devices/claim", json={"code": "ZZZZ-ZZZZ", "name": "a", "kind": "ide"})
        assert r.status_code == 400

    async def test_token_stored_hashed(self, app, env):
        ac, user = env
        token = (await _pair(ac, user))["device_token"]
        with app.state.db_engine.connect() as conn:
            hashes = [r.token_hash for r in conn.execute(device_tokens_table.select())]
        assert token not in hashes
        assert all(len(h) == 64 for h in hashes)


class TestDeviceTokenScope:
    async def test_device_can_send_telemetry_and_read_state(self, env):
        ac, user = env
        dev = {"Authorization": f"Bearer {(await _pair(ac, user))['device_token']}"}
        r = await ac.post(
            "/telemetry/batch",
            json=[{"source": "browser", "type": "TAB_SWITCH", "data": {}}],
            headers=dev,
        )
        assert r.status_code == 202
        assert (await ac.get("/state", headers=dev)).status_code == 200
        assert (await ac.get("/actions/focus", headers=dev)).status_code == 200

    async def test_device_state_shows_source_last_seen(self, env):
        ac, user = env
        dev = {"Authorization": f"Bearer {(await _pair(ac, user))['device_token']}"}
        await ac.post(
            "/telemetry/event",
            json={"source": "ide", "type": "FILE_SAVE", "data": {}},
            headers=dev,
        )
        sources = (await ac.get("/state", headers=dev)).json()["sources"]
        assert "ide" in sources

    async def test_device_cannot_use_account_endpoints(self, env):
        ac, user = env
        dev = {"Authorization": f"Bearer {(await _pair(ac, user))['device_token']}"}
        for path in ("/actions/tasks", "/timeline", "/settings", "/devices", "/auth/me"):
            r = await ac.get(path, headers=dev)
            assert r.status_code == 403, path

    async def test_whoami(self, env):
        ac, user = env
        dev = {"Authorization": f"Bearer {(await _pair(ac, user, name='VS Code', kind='ide'))['device_token']}"}
        body = (await ac.get("/devices/whoami", headers=dev)).json()
        assert body["user_email"] == "devices@example.com"
        assert body["device"]["name"] == "VS Code"

    async def test_bad_device_token_rejected(self, env):
        ac, _ = env
        r = await ac.get("/state", headers={"Authorization": "Bearer clr_dev_nope"})
        assert r.status_code == 401


class TestDeviceManagement:
    async def test_list_and_revoke(self, env):
        ac, user = env
        paired = await _pair(ac, user, name="To revoke")
        dev = {"Authorization": f"Bearer {paired['device_token']}"}
        listed = (await ac.get("/devices", headers=user)).json()
        assert any(d["id"] == paired["device"]["id"] for d in listed)

        r = await ac.delete(f"/devices/{paired['device']['id']}", headers=user)
        assert r.status_code == 200
        assert (await ac.get("/state", headers=dev)).status_code == 401
        listed = (await ac.get("/devices", headers=user)).json()
        assert all(d["id"] != paired["device"]["id"] for d in listed)

    async def test_cannot_revoke_someone_elses_device(self, app, env):
        ac, user = env
        paired = await _pair(ac, user)
        other = {"Authorization": f"Bearer {make_user_token(app, 'devices-other@example.com')}"}
        r = await ac.delete(f"/devices/{paired['device']['id']}", headers=other)
        assert r.status_code == 404

    async def test_device_can_unpair_itself(self, env):
        ac, user = env
        dev = {"Authorization": f"Bearer {(await _pair(ac, user))['device_token']}"}
        assert (await ac.delete("/devices/self", headers=dev)).status_code == 200
        assert (await ac.get("/state", headers=dev)).status_code == 401
