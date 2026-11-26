"""
/state/ws — token must arrive in the first message, not the URL.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from engine.api.app import create_app
from tests.conftest import make_user_token


@pytest.fixture(scope="module")
def tc():
    app = create_app()
    with TestClient(app) as client:
        client.app_token = make_user_token(app, "ws@example.com")
        yield client


def test_valid_auth_message_streams_state(tc):
    with tc.websocket_connect("/state/ws") as ws:
        ws.send_json({"type": "auth", "token": tc.app_token})
        state = ws.receive_json()
    assert set(state) >= {"load_score", "context", "confidence", "breakdown", "sources"}


def test_invalid_token_closes_4001(tc):
    with tc.websocket_connect("/state/ws") as ws:
        ws.send_json({"type": "auth", "token": "not-a-token"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == 4001


def test_token_in_query_string_is_not_accepted(tc):
    with tc.websocket_connect(f"/state/ws?token={tc.app_token}") as ws:
        ws.send_json({"type": "hello"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
    assert exc.value.code == 4001
