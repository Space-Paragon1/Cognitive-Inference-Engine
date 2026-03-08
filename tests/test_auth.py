"""
Tests for the /auth endpoints — register, login, me.
Also verifies that protected routes reject unauthenticated requests.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from engine.api.app import create_app


@pytest.fixture(scope="module")
def app():
    return create_app()


@pytest.fixture(scope="module")
async def unauthed_client(app):
    """Client with NO auth token — used to test 401 responses."""
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac


class TestRegister:
    async def test_register_success(self, unauthed_client):
        unique_email = f"newuser-{uuid.uuid4().hex[:8]}@example.com"
        r = await unauthed_client.post("/auth/register", json={
            "email": unique_email,
            "password": "securepassword",
        })
        assert r.status_code == 201
        body = r.json()
        assert body["email"] == unique_email
        assert "id" in body
        assert "created_at" in body
        assert "password" not in body
        assert "hashed_password" not in body

    async def test_register_duplicate_email(self, unauthed_client):
        await unauthed_client.post("/auth/register", json={
            "email": "duplicate@example.com",
            "password": "password123",
        })
        r = await unauthed_client.post("/auth/register", json={
            "email": "duplicate@example.com",
            "password": "password123",
        })
        assert r.status_code == 409

    async def test_register_short_password(self, unauthed_client):
        r = await unauthed_client.post("/auth/register", json={
            "email": "short@example.com",
            "password": "abc",
        })
        assert r.status_code == 422

    async def test_register_invalid_email(self, unauthed_client):
        r = await unauthed_client.post("/auth/register", json={
            "email": "not-an-email",
            "password": "validpassword",
        })
        assert r.status_code == 422


class TestLogin:
    async def test_login_success(self, unauthed_client):
        await unauthed_client.post("/auth/register", json={
            "email": "loginuser@example.com",
            "password": "mypassword1",
        })
        r = await unauthed_client.post("/auth/login", json={
            "email": "loginuser@example.com",
            "password": "mypassword1",
        })
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert len(body["access_token"]) > 20

    async def test_login_wrong_password(self, unauthed_client):
        await unauthed_client.post("/auth/register", json={
            "email": "wrongpass@example.com",
            "password": "correctpass",
        })
        r = await unauthed_client.post("/auth/login", json={
            "email": "wrongpass@example.com",
            "password": "wrongpass",
        })
        assert r.status_code == 401

    async def test_login_unknown_email(self, unauthed_client):
        r = await unauthed_client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "doesntmatter",
        })
        assert r.status_code == 401


class TestMe:
    async def test_me_requires_auth(self, unauthed_client):
        r = await unauthed_client.get("/auth/me")
        assert r.status_code == 401

    async def test_me_returns_user(self, unauthed_client):
        await unauthed_client.post("/auth/register", json={
            "email": "meuser@example.com",
            "password": "password123",
        })
        login = await unauthed_client.post("/auth/login", json={
            "email": "meuser@example.com",
            "password": "password123",
        })
        token = login.json()["access_token"]

        r = await unauthed_client.get(
            "/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == "meuser@example.com"

    async def test_me_invalid_token(self, unauthed_client):
        r = await unauthed_client.get(
            "/auth/me", headers={"Authorization": "Bearer invalidtoken"}
        )
        assert r.status_code == 401


class TestProtectedRoutes:
    async def test_state_requires_auth(self, unauthed_client):
        r = await unauthed_client.get("/state")
        assert r.status_code == 401

    async def test_telemetry_requires_auth(self, unauthed_client):
        r = await unauthed_client.post("/telemetry/event", json={
            "source": "browser", "type": "TAB_SWITCH", "data": {},
        })
        assert r.status_code == 401

    async def test_actions_requires_auth(self, unauthed_client):
        r = await unauthed_client.get("/actions/directives")
        assert r.status_code == 401

    async def test_timeline_requires_auth(self, unauthed_client):
        r = await unauthed_client.get("/timeline")
        assert r.status_code == 401

    async def test_settings_requires_auth(self, unauthed_client):
        r = await unauthed_client.get("/settings")
        assert r.status_code == 401

    async def test_health_is_public(self, unauthed_client):
        """The /health endpoint must remain accessible without auth."""
        r = await unauthed_client.get("/health")
        assert r.status_code == 200
