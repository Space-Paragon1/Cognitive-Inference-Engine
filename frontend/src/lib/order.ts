/* Load-aware task order, mirroring engine/router/scheduler.py so the UI and the
   engine agree: at or above the high-load threshold easy and review come first;
   under 40% hard comes first; otherwise medium first with hard close behind. */
import type { Task } from "../types";
import type { Difficulty } from "../types/ui";

export type OrderRule = "high" | "normal" | "low";

export function orderRule(load: number, high: number): OrderRule {
  if (load >= high) return "high";
  if (load < 0.4) return "low";
  return "normal";
}

const RANK: Record<OrderRule, Record<Difficulty, number>> = {
  high: { easy: 0, review: 1, medium: 2, hard: 3 },
  normal: { medium: 0, hard: 1, review: 2, easy: 3 },
  low: { hard: 0, medium: 1, review: 2, easy: 3 },
};

/** Stable sort by the rule for this load. */
export function orderTasks<T extends Pick<Task, "difficulty">>(tasks: T[], load: number, high: number): T[] {
  const rank = RANK[orderRule(load, high)];
  return tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank[a.t.difficulty] - rank[b.t.difficulty] || a.i - b.i)
    .map((x) => x.t);
}

/** "How the order works" lines from voice.md. */
export const RULE_COPY: Record<OrderRule, string> = {
  high: "Easy and review first",
  normal: "Medium first, hard close behind",
  low: "Hard first, while you are fresh",
};

/** Pomodoro length from load, mirroring scheduler.suggest_pomodoro_duration. */
export function pomodoroMinutes(load: number, high: number, fatigue: number): number {
  if (load >= fatigue) return 10;
  if (load >= high) return 15;
  if (load >= 0.45) return 25;
  return 35;
}

/** The why line: "15 min because your load is high (78%)." */
export function whyLine(minutes: number, load: number | null, high: number, fatigue: number, confidence = 1): string {
  if (load == null) return `${minutes} min because CLR has no reading yet, so it uses your normal length.`;
  const v = Math.round(load * 100);
  const band =
    load >= fatigue ? "showing fatigue" : load >= high ? "high" : load < 0.45 ? "low" : "in your normal range";
  const rough = confidence < 0.5 ? " This is a rough estimate." : "";
  return `${minutes} min because your load is ${band} (${v}%).${rough}`;
}

/** The line under Up next: why this task comes first right now. */
export function upNextWhy(load: number | null, high: number, confidence = 1): string {
  if (load == null) return "Tasks still work without sources. They reorder once CLR can read your load.";
  const v = `${Math.round(load * 100)}%`;
  const rough = confidence < 0.5 ? " The order may shift as CLR learns how you work today." : "";
  switch (orderRule(load, high)) {
    case "high":
      return `Easy and review work suits a high ${v}. Hard tasks wait until your load settles.${rough}`;
    case "low":
      return `Load is low (${v}), so hard work goes first while you are fresh.${rough}`;
    default:
      return `Medium work suits a steady ${v}. Hard tasks stay on deck for a lower-load window.${rough}`;
  }
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}
