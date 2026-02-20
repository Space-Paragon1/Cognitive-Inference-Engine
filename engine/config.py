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


@dataclass
class Config:
    # API
    api_host: str = "127.0.0.1"
    api_port: int = 8765

    # Inference
    inference_interval_ms: int = 2000        # how often load is recalculated
    load_history_window_s: int = 300         # rolling window for signal smoothing

    # Telemetry
    telemetry_buffer_size: int = 500         # max events held in memory
    telemetry_flush_interval_s: int = 30

    # Storage
    data_dir: Path = field(default_factory=lambda: _ROOT / "data")
    timeline_db: str = "timeline.db"

    # Action thresholds
    high_load_threshold: float = 0.75
    fatigue_threshold: float = 0.85
    low_load_threshold: float = 0.35

    def __post_init__(self):
        self.data_dir = Path(self.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

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
