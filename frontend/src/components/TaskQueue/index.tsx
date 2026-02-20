import { useEffect, useState } from "react";
import { addTask, getTasks, removeTask } from "../../api/client";
import type { Task, TaskQueue as TaskQueueType } from "../../types";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#4af0a0",
  medium: "#f0d04a",
  hard: "#f05a4a",
  review: "#4ac0f0",
};

export function TaskQueue() {
  const [queue, setQueue] = useState<TaskQueueType | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDiff, setNewDiff] = useState<Task["difficulty"]>("medium");

  const refresh = () => getTasks().then(setQueue).catch(() => {});

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addTask({
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      difficulty: newDiff,
      estimated_minutes: 25,
    });
    setNewTitle("");
    refresh();
  };

  const handleRemove = async (id: string) => {
    await removeTask(id);
    refresh();
  };

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Task Queue
        {queue && (
          <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.4, textTransform: "none" }}>
            (recommended: {queue.recommended_duration_minutes} min sessions)
          </span>
        )}
      </h3>

      {/* Add task */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add task…"
          style={{
            flex: 1, background: "#1e1e3a", border: "1px solid #2a2a4a",
            borderRadius: 6, padding: "6px 10px", color: "#e0e0f0", fontSize: 13,
          }}
        />
        <select
          value={newDiff}
          onChange={(e) => setNewDiff(e.target.value as Task["difficulty"])}
          style={{
            background: "#1e1e3a", border: "1px solid #2a2a4a",
            borderRadius: 6, padding: "6px 8px", color: "#e0e0f0", fontSize: 12,
          }}
        >
          {["easy", "medium", "hard", "review"].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          style={{
            background: "#4a4af0", border: "none", borderRadius: 6,
            padding: "6px 12px", color: "#fff", fontSize: 12, cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>

      {/* Task list */}
      {queue?.tasks.length === 0 && (
        <div style={{ opacity: 0.3, fontSize: 13 }}>No tasks — add one above.</div>
      )}
      {queue?.tasks.map((task, i) => (
        <div key={task.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", borderRadius: 8,
          background: i === 0 ? "#1e1e3a" : "transparent",
          marginBottom: 4,
        }}>
          <span style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 10,
            background: DIFFICULTY_COLORS[task.difficulty] + "33",
            color: DIFFICULTY_COLORS[task.difficulty],
            fontWeight: 600, flexShrink: 0,
          }}>
            {task.difficulty}
          </span>
          <span style={{ flex: 1, fontSize: 13, opacity: i === 0 ? 1 : 0.6 }}>
            {task.title}
          </span>
          <span style={{ fontSize: 11, opacity: 0.3, flexShrink: 0 }}>
            {task.estimated_minutes}m
          </span>
          <button
            onClick={() => handleRemove(task.id)}
            style={{
              background: "none", border: "none", color: "#f05a4a",
              cursor: "pointer", fontSize: 14, padding: 0, opacity: 0.5,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
