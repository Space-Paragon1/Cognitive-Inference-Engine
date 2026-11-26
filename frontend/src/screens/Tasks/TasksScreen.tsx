import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useGaugeState } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { useTasks } from "../../live/TasksState";
import { orderRule } from "../../lib/order";
import { Banner } from "../../components/Banner";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Cell, ConnectionBanner, Grid, LiveStatus, Page, useShell } from "../../components/Shell";
import { AddTaskForm, HowOrderWorks, TaskQueue } from "../../components/TaskQueue";
import type { AddTaskFormHandle } from "../../components/TaskQueue";

export function TasksScreen() {
  const { layout } = useShell();
  const mobile = layout === "mobile";
  const g = useGaugeState();
  const { thresholds } = useSettings();
  const { saveError, retry, queued } = useTasks();
  const formRef = useRef<AddTaskFormHandle>(null);
  const sheetFormRef = useRef<AddTaskFormHandle>(null);
  const [sheet, setSheet] = useState(false);
  const [why, setWhy] = useState(false);
  const rule = g.load == null ? null : orderRule(g.load, thresholds.high);

  const openAdd = () => (mobile ? setSheet(true) : formRef.current?.focus());

  const banner = (
    <>
      <ConnectionBanner offlineBody={`Edits are kept on this device and sync when you are back.${queued ? ` ${queued} waiting.` : ""}`} />
      {saveError && <Banner tone="critical" title="Couldn't save your task." body="Check your connection." action={{ label: "Retry", onClick: retry }} />}
    </>
  );

  return (
    <Page
      title="Tasks"
      sub="Ordered for how you are doing right now"
      banner={banner}
      actions={
        <>
          <LiveStatus />
          <Button icon={Plus} onClick={openAdd}>
            Add task
          </Button>
        </>
      }
    >
      {mobile ? (
        <TaskQueue bare onAdd={openAdd} onWhy={() => setWhy(true)} />
      ) : (
        <Grid>
          <Cell span={8}>
            <TaskQueue onAdd={openAdd} />
          </Cell>
          <Cell span={4} tablet={8}>
            <Card title="Add a task" titleId="add-task-title">
              <AddTaskForm ref={formRef} />
            </Card>
            <HowOrderWorks current={rule} />
          </Cell>
        </Grid>
      )}
      <BottomSheet
        open={sheet}
        title="Add a task"
        onClose={() => setSheet(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSheet(false)}>
              Cancel
            </Button>
            <Button onClick={() => sheetFormRef.current?.submit()}>Add task</Button>
          </>
        }
      >
        <AddTaskForm ref={sheetFormRef} hideSubmit onAdded={() => setSheet(false)} />
      </BottomSheet>
      <BottomSheet open={why} title="How the order works" onClose={() => setWhy(false)}>
        <HowOrderWorks current={rule} bare />
      </BottomSheet>
    </Page>
  );
}
