"""
Entry point — start the Cognitive Load Router engine.

Usage:
    python -m engine.main
    uvicorn engine.api.app:app --host 127.0.0.1 --port 8765 --reload
"""

import os

import uvicorn

from .config import config


def main():
    # Railway (and most PaaS platforms) inject PORT into the environment.
    # When running locally the config default (8765) is used.
    port = int(os.environ.get("PORT", config.api_port))
    host = "0.0.0.0" if os.environ.get("PORT") else config.api_host

    uvicorn.run(
        "engine.api.app:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
