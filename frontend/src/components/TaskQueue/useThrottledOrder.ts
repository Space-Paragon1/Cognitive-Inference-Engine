/* Task reorder rules from handoff.md: recompute on every tick, apply at most once
   every 30 s, never while the pointer or focus is inside the list, animate with
   FLIP, and show "moved" chips for 4 s. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Task } from "../../types";

const THROTTLE_MS = 30000;
const MOVED_MS = 4000;

export function useThrottledOrder(target: Task[], listRef: RefObject<HTMLElement>, paused: boolean) {
  const [ids, setIds] = useState<string[]>(() => target.map((t) => t.id));
  const [moved, setMoved] = useState<Record<string, number>>({});
  const lastApply = useRef(0);
  const interacting = useRef(false);
  const [tick, setTick] = useState(0);
  const movedTimer = useRef<number | null>(null);

  // Track pointer and focus inside the list.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let pointer = false;
    let focus = false;
    const sync = () => {
      const was = interacting.current;
      interacting.current = pointer || focus;
      if (was && !interacting.current) setTick((n) => n + 1);
    };
    const enter = () => ((pointer = true), sync());
    const leave = () => ((pointer = false), sync());
    const fin = () => ((focus = true), sync());
    const fout = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) {
        focus = false;
        sync();
      }
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focusin", fin);
    el.addEventListener("focusout", fout);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", fin);
      el.removeEventListener("focusout", fout);
    };
  }, [listRef]);

  const targetIds = target.map((t) => t.id).join("|");

  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    const next = targetIds ? targetIds.split("|") : [];
    const cur = idsRef.current;
    const sameSet = cur.length === next.length && cur.every((id) => next.includes(id));
    if (!sameSet) {
      // Adds and removals apply at once; existing tasks keep their place until the next reorder.
      const kept = cur.filter((id) => next.includes(id));
      const added = next.filter((id) => !cur.includes(id));
      setIds(cur.length === 0 ? next : [...kept, ...added]);
      return;
    }
    if (cur.join("|") === targetIds) return;
    const now = Date.now();
    if (paused || interacting.current) return;
    if (now - lastApply.current < THROTTLE_MS) {
      const t = window.setTimeout(() => setTick((n) => n + 1), THROTTLE_MS - (now - lastApply.current) + 50);
      return () => window.clearTimeout(t);
    }
    lastApply.current = now;
    const m: Record<string, number> = {};
    next.forEach((id, i) => {
      const d = cur.indexOf(id) - i;
      if (d) m[id] = d;
    });
    setIds(next);
    setMoved(m);
    if (movedTimer.current) window.clearTimeout(movedTimer.current);
    movedTimer.current = window.setTimeout(() => setMoved({}), MOVED_MS);
  }, [targetIds, paused, tick]);

  /** Apply the target order now (switching to Auto order, first load). */
  const applyNow = useCallback(() => {
    lastApply.current = Date.now();
    setIds(targetIds ? targetIds.split("|") : []);
    setMoved({});
  }, [targetIds]);

  useEffect(() => () => {
    if (movedTimer.current) window.clearTimeout(movedTimer.current);
  }, []);

  const byId = new Map(target.map((t) => [t.id, t]));
  const ordered = ids.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t));
  return { ordered, moved, applyNow };
}
