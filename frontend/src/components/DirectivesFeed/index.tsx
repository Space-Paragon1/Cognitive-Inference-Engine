import { useEffect, useState } from "react";
import { getDirectives } from "../../api/client";
import type { ActionDirective, ActiveActions } from "../../types";
import css from "./DirectivesFeed.module.css";

// ── Directive metadata ────────────────────────────────────────────────────────

const DIRECTIVE_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  recommend_break:        { label: "Take a break",            icon: "☕", color: "#f0c040" },
  suppress_notifications: { label: "Notifications silenced",  icon: "🔕", color: "#b066cc" },
  block_distracting_tabs: { label: "Distracting tabs blocked",icon: "🛡",  color: "#f08040" },
  suggest_task:           { label: "Suggested task",          icon: "📌", color: "#4ab0f0" },
  shorten_focus_interval: { label: "Shorten focus session",   icon: "⏱",  color: "#f0c040" },
  delay_hard_tasks:       { label: "Defer hard tasks",        icon: "⏸",  color: "#888" },
  schedule_hard_task:     { label: "Good time for hard work", icon: "⚡", color: "#4af0a0" },
  allow_notifications:    { label: "Notifications OK",        icon: "🔔", color: "#4af0a0" },
};

function metaFor(actionType: string) {
  return (
    DIRECTIVE_META[actionType] ?? {
      label: actionType.replace(/_/g, " "),
      icon: "▸",
      color: "#aaa",
    }
  );
}

function fmtParams(params: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (params.duration_min) parts.push(`${params.duration_min} min`);
  if (params.minutes)      parts.push(`${params.minutes} min`);
  if (params.type)         parts.push(String(params.type));
  if (params.difficulty)   parts.push(String(params.difficulty));
  return parts.length ? parts.join(" · ") : null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: number }) {
  const isHigh = priority <= 2;
  return (
    <span
      className={css.priorityBadge}
      style={{
        background: isHigh ? "#f05a4a22" : "#ffffff0d",
        color: isHigh ? "#f05a4a" : "#666",
        border: `1px solid ${isHigh ? "#f05a4a44" : "#ffffff11"}`,
      }}
    >
      P{priority}
    </span>
  );
}

function DirectiveRow({ directive }: { directive: ActionDirective }) {
  const meta = metaFor(directive.action_type);
  const extra = fmtParams(directive.params);

  return (
    <div className={css.row}>
      <span className={css.icon} style={{ color: meta.color }}>
        {meta.icon}
      </span>
      <div className={css.body}>
        <div className={css.label} style={{ color: meta.color }}>
          {meta.label}
          {extra && <span className={css.extra}> — {extra}</span>}
        </div>
        {directive.reason && (
          <div className={css.reason}>{directive.reason}</div>
        )}
      </div>
      <PriorityBadge priority={directive.priority} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className={css.empty}>
      <span className={css.emptyIcon}>✓</span>
      <div>All clear — no active directives</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DirectivesFeed() {
  const [data, setData] = useState<ActiveActions | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;

    function refresh() {
      getDirectives()
        .then((d) => { if (alive) { setData(d); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    }

    refresh();
    const id = setInterval(refresh, 5_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const directives = data?.directives ?? [];

  return (
    <div>
      <div className={css.header}>
        <h3 className={css.heading}>Engine Directives</h3>
        {directives.length > 0 && (
          <span className={css.count}>{directives.length} active</span>
        )}
      </div>

      {error ? (
        <p className={css.offline}>Engine offline</p>
      ) : directives.length === 0 ? (
        <EmptyState />
      ) : (
        <div className={css.list}>
          {directives.map((d, i) => (
            <DirectiveRow key={`${d.action_type}-${i}`} directive={d} />
          ))}
        </div>
      )}
    </div>
  );
}
