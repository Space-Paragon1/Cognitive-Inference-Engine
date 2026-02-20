"""
Routing Rules — declarative policy definitions.

Each rule maps a (CognitiveContext, load_score_range) combination
to a list of Action directives.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from ..inference.context_classifier import CognitiveContext


@dataclass
class ActionDirective:
    """A single action the routing engine should execute."""
    action_type: str                 # e.g. "suppress_notifications"
    params: dict = field(default_factory=dict)
    priority: int = 5                # 1 (highest) → 10 (lowest)
    reason: str = ""


@dataclass
class RoutingRule:
    context: CognitiveContext
    load_min: float                  # inclusive lower bound
    load_max: float                  # inclusive upper bound
    actions: List[ActionDirective]
    description: str = ""


# ---------------------------------------------------------------------------
# Rule registry — ordered by priority (first match wins within same context)
# ---------------------------------------------------------------------------

RULES: List[RoutingRule] = [

    # ── STUCK ──────────────────────────────────────────────────────────────
    RoutingRule(
        context=CognitiveContext.STUCK,
        load_min=0.6, load_max=1.0,
        description="High-load stuck loop: redirect to review material",
        actions=[
            ActionDirective("suppress_notifications", priority=1,
                            reason="Student is stuck — eliminate interruptions"),
            ActionDirective("suggest_task", params={"type": "review", "difficulty": "easy"},
                            priority=2, reason="Surface prerequisite material"),
            ActionDirective("shorten_focus_interval", params={"minutes": 10},
                            priority=3, reason="Reduce pressure by shortening session"),
            ActionDirective("block_distracting_tabs", priority=2,
                            reason="Limit scope of context switches"),
        ],
    ),

    # ── DEEP FOCUS ─────────────────────────────────────────────────────────
    RoutingRule(
        context=CognitiveContext.DEEP_FOCUS,
        load_min=0.3, load_max=0.75,
        description="Optimal deep-work state: protect and sustain",
        actions=[
            ActionDirective("suppress_notifications", priority=1,
                            reason="Protect deep focus window"),
            ActionDirective("block_distracting_tabs", priority=2,
                            reason="Reduce extraneous load"),
        ],
    ),

    # ── FATIGUE ────────────────────────────────────────────────────────────
    RoutingRule(
        context=CognitiveContext.FATIGUE,
        load_min=0.85, load_max=1.0,
        description="Fatigue detected: initiate recovery protocol",
        actions=[
            ActionDirective("recommend_break", params={"duration_min": 15},
                            priority=1, reason="Cognitive recovery needed"),
            ActionDirective("delay_hard_tasks", priority=2,
                            reason="Defer high-difficulty work until recovery"),
            ActionDirective("suppress_notifications", priority=1,
                            reason="Reduce stimulus during recovery"),
        ],
    ),

    # ── SHALLOW WORK ───────────────────────────────────────────────────────
    RoutingRule(
        context=CognitiveContext.SHALLOW_WORK,
        load_min=0.3, load_max=0.7,
        description="Scattered attention: consolidate focus",
        actions=[
            ActionDirective("suggest_task", params={"type": "current", "difficulty": "medium"},
                            priority=3, reason="Bring attention back to primary task"),
        ],
    ),

    # ── LOW LOAD (any context) ─────────────────────────────────────────────
    RoutingRule(
        context=CognitiveContext.RECOVERING,
        load_min=0.0, load_max=0.35,
        description="Low load / recovering: schedule challenging work",
        actions=[
            ActionDirective("schedule_hard_task", priority=4,
                            reason="Low load is ideal for high-difficulty material"),
            ActionDirective("allow_notifications", priority=5,
                            reason="Student has capacity for minor interruptions"),
        ],
    ),
]
