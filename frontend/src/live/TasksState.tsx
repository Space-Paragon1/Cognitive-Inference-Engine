/* The task queue, shared by Now (up next), Tasks and the sidebar count.
   Edits apply at once and queue locally while offline or when a save fails
   (handoff.md state matrix: "edits queue locally"). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { addTask, getTasks, removeTask } from "../api/client";
import type { Task } from "../types";

type Op = { kind: "add"; task: Task } | { kind: "remove"; id: string };

export interface NewTask {
  title: string;
  difficulty: Task["difficulty"];
  estimated_minutes: number;
  tags?: string[];
}

interface TasksApi {
  tasks: Task[];
  recommendedMinutes: number | null;
  loading: boolean;
  loadError: boolean;
  /** Edits waiting to reach the engine. */
  queued: number;
  saveError: boolean;
  add: (input: NewTask) => Task;
  /** Remove a task (complete or delete). Returns it so the caller can offer Undo. */
  complete: (id: string) => Task | undefined;
  /** Put a completed task back (Undo). */
  restore: (task: Task) => void;
  /** Delete without marking done. */
  remove: (id: string) => Task | undefined;
  /** Tasks completed today on this device (the engine keeps no history). */
  doneToday: Task[];
  retry: () => void;
  reload: () => void;
}

const TasksContext = createContext<TasksApi | null>(null);

// TODO(backend): the API only deletes tasks, so "Done today" is kept on this device.
const doneKey = () => `clr_done_${new Date().toISOString().slice(0, 10)}`;
function readDone(): Task[] {
  try {
    return JSON.parse(localStorage.getItem(doneKey()) ?? "[]") as Task[];
  } catch {
    return [];
  }
}
function writeDone(tasks: Task[]) {
  try {
    localStorage.setItem(doneKey(), JSON.stringify(tasks));
  } catch {
    /* storage blocked */
  }
}
const POLL_MS = 5000;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function applyOps(server: Task[], ops: Op[]): Task[] {
  let out = server.slice();
  for (const op of ops) {
    if (op.kind === "add") {
      if (!out.some((t) => t.id === op.task.id)) out.push(op.task);
    } else {
      out = out.filter((t) => t.id !== op.id);
    }
  }
  return out;
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<Task[]>([]);
  const [recommendedMinutes, setRecommended] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [ops, setOps] = useState<Op[]>([]);
  const [saveError, setSaveError] = useState(false);
  const [doneToday, setDoneToday] = useState<Task[]>(readDone);
  const opsRef = useRef<Op[]>([]);
  const flushing = useRef(false);
  opsRef.current = ops;

  const reload = useCallback(async () => {
    try {
      const q = await getTasks();
      setServer(q.tasks);
      setRecommended(q.recommended_duration_minutes);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      while (opsRef.current.length) {
        const op = opsRef.current[0];
        if (op.kind === "add") await addTask(op.task);
        else await removeTask(op.id).catch((e: Error) => {
          // Already gone on the engine: nothing left to do.
          if (!/^404/.test(e.message)) throw e;
        });
        opsRef.current = opsRef.current.slice(1);
        setOps(opsRef.current);
      }
      setSaveError(false);
      await reload();
    } catch {
      setSaveError(navigator.onLine);
    } finally {
      flushing.current = false;
    }
  }, [reload]);

  useEffect(() => {
    reload();
    const poll = window.setInterval(() => {
      if (!opsRef.current.length) reload();
    }, POLL_MS);
    const online = () => flush();
    window.addEventListener("online", online);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("online", online);
    };
  }, [reload, flush]);

  const push = useCallback(
    (op: Op) => {
      opsRef.current = [...opsRef.current, op];
      setOps(opsRef.current);
      flush();
    },
    [flush]
  );

  const tasks = useMemo(() => applyOps(server, ops), [server, ops]);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const add = useCallback(
    (input: NewTask) => {
      const task: Task = { id: newId(), ...input, tags: input.tags ?? [], title: input.title.trim() };
      push({ kind: "add", task });
      return task;
    },
    [push]
  );

  const remove = useCallback(
    (id: string) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (task) push({ kind: "remove", id });
      return task;
    },
    [push]
  );

  const complete = useCallback(
    (id: string) => {
      const task = remove(id);
      if (task)
        setDoneToday((d) => {
          const next = [task, ...d.filter((x) => x.id !== id)];
          writeDone(next);
          return next;
        });
      return task;
    },
    [remove]
  );

  // The engine keeps insertion order, so a restored task goes back on the end;
  // the screen's order rule puts it where it belongs.
  const restore = useCallback(
    (task: Task) => {
      push({ kind: "add", task });
      setDoneToday((d) => {
        const next = d.filter((x) => x.id !== task.id);
        writeDone(next);
        return next;
      });
    },
    [push]
  );

  const api = useMemo<TasksApi>(
    () => ({
      tasks,
      recommendedMinutes,
      loading,
      loadError,
      queued: ops.length,
      saveError,
      add,
      complete,
      restore,
      remove,
      doneToday,
      retry: flush,
      reload,
    }),
    [tasks, recommendedMinutes, loading, loadError, ops.length, saveError, add, complete, restore, remove, doneToday, flush, reload]
  );
  return <TasksContext.Provider value={api}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksApi {
  const v = useContext(TasksContext);
  if (!v) throw new Error("useTasks must be used inside <TasksProvider>");
  return v;
}
