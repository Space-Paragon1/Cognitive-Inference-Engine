/* Directive cards for the feed: engine directives + live state -> card props. */
import { useMemo } from "react";
import type { DirectiveCardProps } from "../types/ui";
import { toCards } from "../lib/directives";
import { orderTasks } from "../lib/order";
import { navigate } from "../lib/router";
import { asContext } from "../lib/domain";
import { useDirectives } from "./DirectivesState";
import { useLive, shallowEqual } from "./LiveState";
import { useSettings } from "./SettingsState";
import { useTasks } from "./TasksState";
import { useTimer } from "./TimerState";

const ACTIONS: Partial<Record<string, DirectiveCardProps["action"]>> = {
  recommend_break: { label: "Start break", onClick: () => navigate("focus") },
  suggest_task: { label: "Open", onClick: () => navigate("tasks") },
  schedule_hard_task: { label: "Start", onClick: () => navigate("focus") },
};

export function useDirectiveCards(): { cards: DirectiveCardProps[]; loading: boolean; error: boolean } {
  const { items, loading, error } = useDirectives();
  const { thresholds } = useSettings();
  const { tasks } = useTasks();
  const timer = useTimer();
  const inSession = Boolean((timer.pomodoro && timer.pomodoro.phase !== "idle") || timer.focus?.active);
  const live = useLive(
    (s) => {
      // Consecutive readings above the fatigue line, newest first, at one per 2 s.
      let run = 0;
      for (let i = s.points.length - 1; i >= 0 && s.points[i].load > thresholds.fatigue; i--) run++;
      return {
        load: s.state ? s.state.load_score : null,
        context: asContext(s.state?.context),
        minutesAboveFatigue: Math.floor((run * 2) / 60),
      };
    },
    shallowEqual
  );

  const cards = useMemo(() => {
    const ordered = live.load == null ? tasks : orderTasks(tasks, live.load, thresholds.high);
    return toCards(
      items,
      { load: live.load, context: live.context, fatigue: thresholds.fatigue, tasks: ordered, inSession, minutesAboveFatigue: live.minutesAboveFatigue },
      ACTIONS
    );
  }, [items, live, tasks, thresholds, inSession]);

  return { cards, loading, error };
}
