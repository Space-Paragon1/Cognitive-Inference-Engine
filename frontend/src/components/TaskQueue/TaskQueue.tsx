import { useRef, useState } from "react";
import { ArrowUpDown, ChevronRight, CircleDashed, ListChecks, Mountain, Plus, Trash2 } from "lucide-react";
import type { Task } from "../../types";
import { useGaugeState } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { useTasks } from "../../live/TasksState";
import { useTimer } from "../../live/TimerState";
import { useFlip } from "../../hooks/useFlip";
import { minutes, pct } from "../../lib/format";
import { orderRule, orderTasks } from "../../lib/order";
import { navigate } from "../../lib/router";
import { Banner } from "../Banner";
import { BottomSheet } from "../BottomSheet";
import { Button } from "../Button";
import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import { SegmentedControl } from "../SegmentedControl";
import { SkeletonRegion, SkeletonRow } from "../Skeleton";
import { useToast } from "../Toast";
import { TaskRow } from "./TaskRow";
import { useThrottledOrder } from "./useThrottledOrder";
import styles from "./TaskQueue.module.css";

type Mode = "auto" | "mine";
const MODE_KEY = "clr_task_order";
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "mine" ? "mine" : "auto";
  } catch {
    return "auto";
  }
}

interface Props {
  /** Open the add form (side card focus on desktop, sheet on mobile). */
  onAdd: () => void;
  /** Phone layout: no card chrome, Add task button under the list. */
  bare?: boolean;
  onWhy?: () => void;
}

/** The queue, reordered for the current load (throttled, FLIP-animated), with done today. */
export function TaskQueue({ onAdd, bare = false, onWhy }: Props) {
  const { tasks, loading, complete, restore, remove, doneToday } = useTasks();
  const g = useGaugeState();
  const { thresholds } = useSettings();
  const timer = useTimer();
  const toast = useToast();
  const [mode, setModeState] = useState<Mode>(readMode);
  const [menuFor, setMenuFor] = useState<Task | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const noData = g.load == null;
  const rough = !noData && g.confidence < 0.5;
  const stale = g.status !== "live";
  const effective: Mode = noData ? "mine" : mode;
  const target = effective === "auto" && g.load != null ? orderTasks(tasks, g.load, thresholds.high) : tasks;
  // Low confidence or a stale connection pauses reordering (state matrix).
  const { ordered, moved, applyNow } = useThrottledOrder(target, listRef, rough || stale);
  useFlip(listRef, ordered.map((t) => t.id).join("|"));

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage blocked */
    }
    window.setTimeout(applyNow, 0);
  };

  const done = (id: string) => {
    const t = complete(id);
    if (t) toast.show({ key: `done-${id}`, title: "Task done", body: t.title, tone: "positive", actions: [{ label: "Undo", onClick: () => restore(t) }] });
  };
  const start = async () => {
    if (!timer.pomodoro || timer.pomodoro.phase === "idle") await timer.startPomodoro().catch(() => {});
    navigate("focus");
  };

  const total = tasks.reduce((a, t) => a + t.estimated_minutes, 0);
  const rule = g.load == null ? null : orderRule(g.load, thresholds.high);
  const hard = tasks.find((t) => t.difficulty === "hard");
  // The banner's number changes only when the rule does, so it isn't re-announced every tick.
  const shown = useRef<{ rule: typeof rule; load: number }>({ rule: null, load: 0 });
  if (rule !== shown.current.rule && g.load != null) shown.current = { rule, load: g.load };
  const shownPct = pct(shown.current.load);

  let banner = null;
  if (effective === "auto" && g.load != null && tasks.length > 1) {
    if (rough) {
      banner = <Banner context="unknown" icon={CircleDashed} title="Reordering is paused." body="CLR is still learning how you work today, so your order stays put for now." />;
    } else if (rule === "high") {
      banner = (
        <Banner
          icon={ArrowUpDown}
          title={`Load is high (${shownPct}), so easier tasks are on top.`}
          body={`${hard ? hard.title : "Hard work"} will move back up when you have more headroom.`}
          action={onWhy ? { label: "Why?", onClick: onWhy } : undefined}
        />
      );
    } else if (rule === "low") {
      banner = <Banner context="recovering" icon={Mountain} title={`Load is low (${shownPct}).`} body="Harder tasks are first while you are fresh." action={onWhy ? { label: "Why?", onClick: onWhy } : undefined} />;
    } else {
      banner = (
        <Banner
          context="deep_focus"
          icon={ArrowUpDown}
          title={`Load is steady (${shownPct}).`}
          body="Medium tasks lead, with hard work close behind."
          action={onWhy ? { label: "Why?", onClick: onWhy } : undefined}
        />
      );
    }
  }

  const switcher = !noData && (
    <SegmentedControl
      size="sm"
      label="Task order"
      options={[
        { value: "auto", label: "Auto order" },
        { value: "mine", label: "My order" },
      ]}
      value={mode}
      onChange={setMode}
    />
  );

  const list = (
    <SkeletonRegion
      loading={loading}
      label="Loading tasks"
      fallback={
        <div className={styles.tasks}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      }
    >
      {ordered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing on your list"
          body="Add what is on your plate. CLR will put the right task on top for how you are doing."
          actions={
            <Button icon={Plus} onClick={onAdd}>
              Add a task
            </Button>
          }
        />
      ) : (
        <ul className={styles.tasks} ref={listRef} aria-label="Your queue">
          {ordered.map((t, i) => (
            <li key={t.id} data-flip-key={t.id}>
              <TaskRow
                id={t.id}
                title={t.title}
                difficulty={t.difficulty}
                minutes={t.estimated_minutes}
                tags={t.tags}
                recommended={i === 0 && effective === "auto" && !noData}
                moved={moved[t.id]}
                onToggleDone={done}
                onStart={start}
                onMenu={(id) => setMenuFor(tasks.find((x) => x.id === id) ?? null)}
              />
            </li>
          ))}
        </ul>
      )}
    </SkeletonRegion>
  );

  const doneList = doneToday.length > 0 && (
    <details className={styles.done}>
      <summary>
        <ChevronRight size={16} aria-hidden="true" className={styles.chev} />
        Done today ({doneToday.length})
      </summary>
      <ul className={styles.tasks}>
        {doneToday.map((t) => (
          <li key={t.id}>
            <TaskRow id={t.id} title={t.title} difficulty={t.difficulty} minutes={t.estimated_minutes} tags={t.tags} done onToggleDone={() => restore(t)} />
          </li>
        ))}
      </ul>
    </details>
  );

  const menu = (
    <BottomSheet
      open={menuFor != null}
      title={menuFor?.title ?? "Task"}
      onClose={() => setMenuFor(null)}
      actions={
        <>
          <Button variant="secondary" onClick={() => setMenuFor(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              if (!menuFor) return;
              const t = remove(menuFor.id);
              setMenuFor(null);
              if (t) toast.show({ key: `del-${t.id}`, title: "Task deleted", body: t.title, actions: [{ label: "Undo", onClick: () => restore(t) }] });
            }}
          >
            Delete task
          </Button>
        </>
      }
    >
      <p className={styles.sheetText}>Delete this task from your queue? You can undo straight after.</p>
    </BottomSheet>
  );

  if (bare) {
    return (
      <div className={styles.bare}>
        {switcher && <div className={styles.bareHead}>{switcher}</div>}
        {banner}
        {list}
        {ordered.length > 0 && (
          <Button variant="secondary" block icon={Plus} onClick={onAdd}>
            Add task
          </Button>
        )}
        {doneList}
        {menu}
      </div>
    );
  }

  return (
    <Card
      title="Your queue"
      titleId="queue-title"
      meta={
        <>
          {tasks.length > 0 && (
            <span className={styles.num}>
              {tasks.length} task{tasks.length === 1 ? "" : "s"} · {minutes(total)}
            </span>
          )}
          {switcher}
        </>
      }
    >
      <div className={styles.body}>
        {banner}
        {list}
        {doneList}
      </div>
      {menu}
    </Card>
  );
}
