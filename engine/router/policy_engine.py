"""
Policy Engine — evaluates routing rules against the current cognitive state
and produces an ordered list of ActionDirectives.
"""

from __future__ import annotations

from typing import List

from ..inference.context_classifier import CognitiveContext
from ..inference.load_estimator import LoadEstimate
from .rules import RULES, ActionDirective


class PolicyEngine:
    """
    Matches the current (context, load_score) against the rule registry
    and returns the applicable action directives sorted by priority.
    """

    def evaluate(
        self,
        estimate: LoadEstimate,
        context: CognitiveContext,
    ) -> List[ActionDirective]:
        matched_actions: List[ActionDirective] = []

        for rule in RULES:
            if rule.context != context:
                continue
            if rule.load_min <= estimate.score <= rule.load_max:
                matched_actions.extend(rule.actions)

        # Sort by priority ascending (1 = highest priority)
        matched_actions.sort(key=lambda a: a.priority)
        return matched_actions

    def describe(
        self,
        estimate: LoadEstimate,
        context: CognitiveContext,
    ) -> List[str]:
        """Return human-readable descriptions of the matching rules."""
        descriptions = []
        for rule in RULES:
            if rule.context == context and rule.load_min <= estimate.score <= rule.load_max:
                descriptions.append(rule.description)
        return descriptions
