"""
Convenience launcher — starts the CLR engine and (optionally) the desktop agent.

Usage:
    python start.py             # engine only
    python start.py --agent     # engine + desktop agent
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import threading
import time


def start_engine() -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, "-m", "engine.main"],
        stdout=sys.stdout,
        stderr=sys.stderr,
    )


def start_desktop_agent() -> threading.Thread:
    """Run the desktop agent in-process on a daemon thread."""
    from engine.telemetry.desktop_agent import DesktopAgent
    agent = DesktopAgent()
    agent.start()
    return agent


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the Cognitive Load Router")
    parser.add_argument("--agent", action="store_true", help="Also start the desktop agent")
    args = parser.parse_args()

    print("Starting Cognitive Load Router engine…")
    engine_proc = start_engine()

    if args.agent:
        time.sleep(1.5)  # give engine a moment to bind
        print("Starting desktop agent…")
        start_desktop_agent()
        print("Desktop agent running.")

    print("\nEngine → http://127.0.0.1:8765")
    print("Dashboard → http://localhost:5173  (run: cd frontend && npm run dev)")
    print("Press Ctrl+C to stop.\n")

    try:
        engine_proc.wait()
    except KeyboardInterrupt:
        print("\nShutting down…")
        engine_proc.terminate()
        engine_proc.wait()


if __name__ == "__main__":
    main()
