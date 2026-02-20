"""
Entry point — start the Cognitive Load Router engine.

Usage:
    python -m engine.main
    uvicorn engine.api.app:app --host 127.0.0.1 --port 8765 --reload
"""

import uvicorn
from .config import config


def main():
    uvicorn.run(
        "engine.api.app:app",
        host=config.api_host,
        port=config.api_port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
