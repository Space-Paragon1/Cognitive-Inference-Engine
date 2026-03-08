"""
Shared pytest fixtures and configuration.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from engine.api.app import create_app
from engine.auth.service import create_access_token, hash_password
from engine.db.users import UsersDB


@pytest.fixture(scope="module")
def app():
    """Create a fresh app instance per test module."""
    return create_app()


@pytest_asyncio.fixture(scope="module")
async def client(app):
    """
    Async HTTP client wired directly to the ASGI app.
    Automatically registers a test user and injects the JWT token into
    every request so all existing tests continue to pass without changes.
    """
    async with app.router.lifespan_context(app):
        # Create a test user directly via UsersDB (bypasses HTTP layer)
        users_db: UsersDB = app.state.users_db
        email = "test@example.com"
        if users_db.get_by_email(email) is None:
            users_db.create_user(email, hash_password("testpassword"))
        user = users_db.get_by_email(email)
        token = create_access_token(user.id)

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {token}"},
        ) as ac:
            yield ac
