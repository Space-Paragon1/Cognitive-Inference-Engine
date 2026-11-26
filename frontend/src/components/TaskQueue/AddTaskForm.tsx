import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import type { Task } from "../../types";
import { useTasks } from "../../live/TasksState";
import { Button } from "../Button";
import { SegmentedControl } from "../SegmentedControl";
import { TextField } from "../TextField";
import styles from "./AddTaskForm.module.css";

const LEVELS: { value: Task["difficulty"]; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "review", label: "Review" },
];

export interface AddTaskFormHandle {
  focus: () => void;
  submit: () => void;
}

interface Props {
  /** Called after a task is added (the mobile sheet closes). */
  onAdded?: (task: Task) => void;
  /** Hide the submit button (the sheet renders its own in the footer). */
  hideSubmit?: boolean;
}

/** Title, difficulty, minutes and tags. Adds instantly; offline adds queue. */
export const AddTaskForm = forwardRef<AddTaskFormHandle, Props>(function AddTaskForm({ onAdded, hideSubmit }, ref) {
  const { add } = useTasks();
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Task["difficulty"]>("medium");
  const [mins, setMins] = useState("30");
  const [tags, setTags] = useState("");
  const [tried, setTried] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const titleError = tried && !title.trim() ? "Add a title." : undefined;
  const n = Number(mins);
  const minsError = tried && (!Number.isInteger(n) || n < 1 || n > 480) ? "Use 1 to 480 minutes." : undefined;

  const focusTitle = () => formRef.current?.querySelector<HTMLInputElement>("input")?.focus();

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    setTried(true);
    if (!title.trim() || !Number.isInteger(n) || n < 1 || n > 480) {
      focusTitle();
      return;
    }
    const task = add({
      title,
      difficulty,
      estimated_minutes: n,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setTitle("");
    setTags("");
    setTried(false);
    focusTitle();
    onAdded?.(task);
  };

  useImperativeHandle(ref, () => ({ focus: focusTitle, submit: () => submit() }));

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
      <TextField label="Title" value={title} onChange={setTitle} placeholder="e.g. Read chapter 5" error={titleError} required />
      <div className={styles.field}>
        <span className={styles.label}>Difficulty</span>
        <SegmentedControl block options={LEVELS} value={difficulty} onChange={setDifficulty} label="Difficulty" />
      </div>
      <div className={styles.two}>
        <TextField label="Minutes" type="number" value={mins} onChange={setMins} inputMode="numeric" min={1} max={480} error={minsError} />
        <TextField label="Tags" value={tags} onChange={setTags} placeholder="cs201, math" />
      </div>
      {!hideSubmit && (
        <Button type="submit" block icon={Plus}>
          Add task
        </Button>
      )}
    </form>
  );
});
