"""
Shared pytest fixtures and configuration.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from engine.api.app import create_app


@pytest.fixture(scope="module")
def app():
    """Create a fresh app instance per test module."""
    return create_app()


@pytest_asyncio.fixture(scope="module")
async def client(app):
    """Async HTTP client wired directly to the ASGI app (no server needed)."""
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
