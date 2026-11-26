import { ListPlus } from "lucide-react";
import { useGaugeState } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { useTasks } from "../../live/TasksState";
import { useTimer } from "../../live/TimerState";
import { orderTasks, upNextWhy } from "../../lib/order";
import { href, navigate } from "../../lib/router";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonRegion, SkeletonRow } from "../../components/Skeleton";
import { TaskRow } from "../../components/TaskQueue/TaskRow";
import { useToast } from "../../components/Toast";
import styles from "./UpNextCard.module.css";

/** The task CLR recommends now, with the reason. */
export function UpNextCard() {
  const { tasks, loading, complete, restore } = useTasks();
  const g = useGaugeState();
  const { thresholds } = useSettings();
  const timer = useTimer();
  const toast = useToast();
  const ordered = g.load == null ? tasks : orderTasks(tasks, g.load, thresholds.high);
  const next = ordered[0];

  const done = (id: string) => {
    const t = complete(id);
    if (!t) return;
    toast.show({ key: `done-${id}`, title: "Task done", body: t.title, tone: "positive", actions: [{ label: "Undo", onClick: () => restore(t) }] });
  };

  return (
    <Card
      title="Up next"
      titleId="upnext-title"
      meta={
        <a className={styles.link} href={href("tasks")} onClick={(e) => (e.preventDefault(), navigate("tasks"))}>
          All tasks
        </a>
      }
    >
      <SkeletonRegion loading={loading} label="Loading tasks" fallback={<SkeletonRow />}>
        {next ? (
          <>
            <TaskRow
              id={next.id}
              title={next.title}
              difficulty={next.difficulty}
              minutes={next.estimated_minutes}
              tags={next.tags}
              recommended={g.load != null}
              onToggleDone={done}
              onStart={async () => {
                if (!timer.pomodoro || timer.pomodoro.phase === "idle") await timer.startPomodoro().catch(() => {});
                navigate("focus");
              }}
            />
            <p className={styles.why}>{upNextWhy(g.load, thresholds.high, g.confidence)}</p>
          </>
        ) : (
          <EmptyState
            compact
            icon={ListPlus}
            title="Nothing queued"
            body="Add a task and CLR will slot it in for how you are doing."
            actions={
              <Button variant="secondary" size="sm" onClick={() => navigate("tasks")}>
                Add a task
              </Button>
            }
          />
        )}
      </SkeletonRegion>
    </Card>
  );
}
