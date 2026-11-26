"""
Hardening: login rate limiting, hashed reset tokens, production secret check.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from engine.config import DEFAULT_JWT_SECRET, Config
from engine.db.connection import password_reset_table
from tests.conftest import make_user_token


@pytest_asyncio.fixture(scope="module")
async def env(app):
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield app, ac


class TestLoginRateLimit:
    async def test_repeated_failures_are_throttled(self, env):
        app, ac = env
        make_user_token(app, "limited@example.com")
        statuses = []
        for _ in range(11):
            r = await ac.post(
                "/auth/login", json={"email": "limited@example.com", "password": "wrongpass1"}
            )
            statuses.append(r.status_code)
        assert statuses[:10] == [401] * 10
        assert statuses[10] == 429
        assert "retry-after" in {k.lower() for k in r.headers}

    async def test_success_resets_the_counter(self, env):
        app, ac = env
        make_user_token(app, "resets@example.com", password="rightpass1")
        for _ in range(9):
            await ac.post("/auth/login", json={"email": "resets@example.com", "password": "nope12345"})
        r = await ac.post("/auth/login", json={"email": "resets@example.com", "password": "rightpass1"})
        assert r.status_code == 200
        for _ in range(9):
            r = await ac.post(
                "/auth/login", json={"email": "resets@example.com", "password": "nope12345"}
            )
        assert r.status_code == 401   # not 429: the earlier success cleared the count


class TestResetTokens:
    async def test_reset_tokens_are_stored_hashed(self, env):
        app, _ = env
        make_user_token(app, "reset@example.com")
        users_db = app.state.users_db
        user = users_db.get_by_email("reset@example.com")
        raw = users_db.create_reset_token(user.id)

        with app.state.db_engine.connect() as conn:
            stored = [r.token for r in conn.execute(password_reset_table.select())]
        assert raw not in stored
        assert users_db.get_valid_reset_token(raw) == user.id

    async def test_reset_flow_still_works(self, env):
        app, ac = env
        make_user_token(app, "reset2@example.com")
        users_db = app.state.users_db
        raw = users_db.create_reset_token(users_db.get_by_email("reset2@example.com").id)
        r = await ac.post("/auth/reset-password", json={"token": raw, "new_password": "brandnew123"})
        assert r.status_code == 200
        r = await ac.post("/auth/reset-password", json={"token": raw, "new_password": "again12345"})
        assert r.status_code == 400   # single use


class TestProductionSecret:
    def test_default_secret_refused_in_production(self):
        with pytest.raises(RuntimeError, match="CLR_JWT_SECRET"):
            Config(env="production", jwt_secret=DEFAULT_JWT_SECRET).check_secrets()

    def test_postgres_url_implies_production(self):
        cfg = Config(database_url="postgresql://u:p@h/db", jwt_secret=DEFAULT_JWT_SECRET)
        assert cfg.is_production
        with pytest.raises(RuntimeError):
            cfg.check_secrets()

    def test_real_secret_accepted(self):
        Config(env="production", jwt_secret="x" * 64).check_secrets()

    def test_development_allows_default(self):
        Config(env="development", jwt_secret=DEFAULT_JWT_SECRET).check_secrets()
