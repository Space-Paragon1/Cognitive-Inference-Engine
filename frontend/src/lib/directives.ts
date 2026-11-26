/* User-facing directive reasons, written from design/voice.md ("Directive reasons").
   The engine's own `reason` strings are developer notes ("Student is stuck —
   eliminate interruptions"), so the UI writes its own from the action type,
   its params and the live state. */
import type { ActionDirective, CognitiveContext, Task } from "../types";
import type { DirectiveCardProps } from "../types/ui";
import { isDirectiveType } from "./domain";
import { clock, pct } from "./format";

export interface DirectiveContext {
  load: number | null;
  context: CognitiveContext;
  fatigue: number;
  /** Tasks in the current load-aware order. */
  tasks: Task[];
  /** A Pomodoro or focus session is running. */
  inSession: boolean;
  /** Minutes the load has stayed above the fatigue threshold, if known. */
  minutesAboveFatigue?: number;
}

const quote = (s: string) => `“${s}”`;

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function directiveReason(d: ActionDirective, x: DirectiveContext): string {
  const load = x.load ?? 0;
  switch (d.action_type) {
    case "suppress_notifications":
      if (x.context === "stuck") return "Keeping interruptions away while you work this out.";
      if (x.context === "fatigue" || x.context === "recovering") return "Keeping things quiet while you recover.";
      return "Protecting your deep-focus window.";
    case "block_distracting_tabs":
      if (x.context === "stuck") return "Fewer places to switch to while you work this out.";
      return "Cutting extraneous load while you are in the zone.";
    case "recommend_break": {
      const m = num(d.params.duration_min) ?? 5;
      const above = x.minutesAboveFatigue;
      const lead =
        above && above >= 1
          ? `Load has been above ${pct(x.fatigue)} for ${Math.round(above)} minute${Math.round(above) === 1 ? "" : "s"}.`
          : `Load is above ${pct(x.fatigue)}.`;
      return `${lead} ${m} minutes away will help.`;
    }
    case "suggest_task": {
      const want = d.params.type === "review" ? ["review", "easy"] : null;
      const task = want ? x.tasks.find((t) => want.includes(t.difficulty)) : x.tasks[0];
      if (task) return `${quote(task.title)} fits how you are doing right now.`;
      return d.params.type === "review"
        ? "Some easy review could help you find a way in."
        : "Your main task is a good place to bring your attention back to.";
    }
    case "shorten_focus_interval": {
      const m = num(d.params.minutes) ?? 10;
      return `Next Pomodoro is ${m} min because your load is high (${pct(load)}).`;
    }
    case "delay_hard_tasks": {
      const hard = x.tasks.find((t) => t.difficulty === "hard");
      return hard ? `${hard.title} moved down until your load settles.` : "Hard tasks moved down until your load settles.";
    }
    case "schedule_hard_task": {
      const hard = x.tasks.find((t) => t.difficulty === "hard");
      return `Load is low (${pct(load)}) and steady. A good window for ${hard ? hard.title : "your hardest task"}.`;
    }
    case "allow_notifications":
      return x.inSession ? "Your load is low, so messages can come through." : "You are between sessions, so messages can come through.";
    default:
      return d.reason;
  }
}

export interface TrackedDirective {
  directive: ActionDirective;
  /** When this action type first appeared (ms). */
  since: number;
  /** Arrived after the first load, so it gets the new-item highlight. */
  fresh: boolean;
}

/** Map engine directives to card props, sorted by priority (1 first). Unknown types are skipped. */
export function toCards(
  items: TrackedDirective[],
  x: DirectiveContext,
  actions: Partial<Record<string, DirectiveCardProps["action"]>> = {}
): DirectiveCardProps[] {
  const now = Date.now();
  return items
    .filter((i) => isDirectiveType(i.directive.action_type))
    .slice()
    .sort((a, b) => a.directive.priority - b.directive.priority)
    .map((i) => {
      const type = i.directive.action_type as DirectiveCardProps["type"];
      return {
        type,
        reason: directiveReason(i.directive, x),
        meta: `Since ${clock(i.since)}`,
        action: actions[type],
        isNew: i.fresh && now - i.since < 4000,
      };
    });
}
