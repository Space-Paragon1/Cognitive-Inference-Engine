"""
Shared pytest fixtures and configuration.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from engine.api.app import create_app
from engine.auth.service import create_access_token, hash_password
from engine.config import config
from engine.db.users import UsersDB


@pytest.fixture(scope="session", autouse=True)
def _isolated_data_dir(tmp_path_factory):
    """
    Point the engine at a throwaway data directory for the whole test run so
    tests never read or write the developer's real data/timeline.db.
    """
    original = config.data_dir
    config.data_dir = tmp_path_factory.mktemp("clr-data")
    yield
    config.data_dir = original


def make_user_token(app, email: str, password: str = "testpassword") -> str:
    """Create (or reuse) a user directly in the DB and return a JWT for them."""
    users_db: UsersDB = app.state.users_db
    if users_db.get_by_email(email) is None:
        users_db.create_user(email, hash_password(password))
    return create_access_token(users_db.get_by_email(email).id)


@pytest.fixture(scope="module")
def app():
    """Create a fresh app instance per test module."""
    return create_app()


@pytest_asyncio.fixture(scope="module")
async def client(app):
    """
    Async HTTP client wired directly to the ASGI app, authenticated as a test
    user (the JWT is injected into every request).
    """
    async with app.router.lifespan_context(app):
        token = make_user_token(app, "test@example.com")
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {token}"},
        ) as ac:
            yield ac
