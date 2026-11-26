"""
Central configuration for the Cognitive Load Router engine.
All values can be overridden via environment variables or a local config.json.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

_ROOT = Path(__file__).parent.parent
_CONFIG_FILE = _ROOT / "config.json"


DEFAULT_JWT_SECRET = "dev-secret-change-in-production"


@dataclass
class Config:
    # "development" (local, single machine) or "production" (hosted).
    # Production is also assumed whenever a PostgreSQL database_url is set.
    env: str = "development"

    # API
    api_host: str = "127.0.0.1"
    api_port: int = 8765
    # Comma-separated list of allowed CORS origins.
    # Add your Railway domain + Capacitor app origin here in production.
    # Example: https://myapp.railway.app,capacitor://localhost,http://localhost:5173
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,null"

    # Inference
    inference_interval_ms: int = 2000        # how often load is recalculated
    load_history_window_s: int = 300         # rolling window for signal smoothing

    # Telemetry
    telemetry_buffer_size: int = 500         # max events held in memory
    telemetry_flush_interval_s: int = 30

    # Storage
    data_dir: Path = field(default_factory=lambda: _ROOT / "data")
    timeline_db: str = "timeline.db"
    # Set DATABASE_URL to a PostgreSQL URL to switch from SQLite to Postgres.
    # Example: postgresql://user:password@host:5432/dbname
    # Leave empty to use local SQLite (default for desktop/dev).
    database_url: str = ""

    # Auth
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_expire_days: int = 7

    # Per-user engines with no telemetry or API use for this long are dropped
    # from memory (their history and tasks stay in the database).
    engine_idle_ttl_s: int = 1800

    # Timeline retention: inference ticks older than this many days are thinned
    # to one per minute. 0 disables the job.
    timeline_downsample_after_days: int = 7

    # Action thresholds
    high_load_threshold: float = 0.75
    fatigue_threshold: float = 0.85
    low_load_threshold: float = 0.35

    def __post_init__(self):
        self.data_dir = Path(self.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production" or self.database_url.startswith("postgres")

    def check_secrets(self) -> None:
        """Refuse to run a hosted instance with the built-in JWT secret."""
        if self.is_production and self.jwt_secret == DEFAULT_JWT_SECRET:
            raise RuntimeError(
                "CLR_JWT_SECRET is not set. Refusing to start in production with the "
                "default secret (anyone could forge login tokens). Generate one with:\n"
                "  python -c \"import secrets; print(secrets.token_hex(32))\""
            )

    @classmethod
    def load(cls) -> "Config":
        cfg = cls()
        if _CONFIG_FILE.exists():
            overrides = json.loads(_CONFIG_FILE.read_text())
            for k, v in overrides.items():
                if hasattr(cfg, k):
                    setattr(cfg, k, v)
        # environment variable overrides (CLR_*)
        for k in cfg.__dataclass_fields__:  # type: ignore[attr-defined]
            env_key = f"CLR_{k.upper()}"
            if env_key in os.environ:
                setattr(cfg, k, type(getattr(cfg, k))(os.environ[env_key]))
        return cfg


# Module-level singleton
config = Config.load()
