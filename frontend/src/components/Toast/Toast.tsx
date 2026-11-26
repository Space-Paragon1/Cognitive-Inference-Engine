import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Info, X } from "lucide-react";
import type { ToastProps } from "../../types/ui";
import { CTX, toneAttrs } from "../../lib/domain";
import { Button } from "../Button";
import styles from "./Toast.module.css";

type Props = ToastProps & {
  /** role="alert" (the overload warning); otherwise role="status". */
  urgent?: boolean;
  leaving?: boolean;
};

/** A single toast card. Auto-dismiss is handled by the stack, which pauses it on hover or focus. */
export function Toast({ title, body, icon, context, tone = "accent", actions, onClose, urgent, leaving }: Props) {
  const Icon = icon ?? (context ? CTX[context].icon : Info);
  return (
    <div
      className={[styles.toast, leaving && styles.leaving].filter(Boolean).join(" ")}
      role={urgent ? "alert" : "status"}
      {...toneAttrs(tone, context)}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div>
        <p className={styles.title}>{title}</p>
        {body && <p className={styles.body}>{body}</p>}
        {actions && actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map((a, i) => (
              <Button
                key={a.label}
                variant="ghost"
                size="sm"
                className={a.primary ?? i === 0 ? styles.primary : undefined}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {onClose && (
        <button type="button" className={styles.close} aria-label="Dismiss" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ---------- Stack and API ---------- */

export type ToastInput = Omit<Props, "onClose" | "leaving"> & {
  /** Replace any visible toast with the same key instead of stacking a duplicate. */
  key?: string;
  onClose?: () => void;
};
type Entry = ToastInput & { id: number; leaving?: boolean };

interface ToastApi {
  show: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const MAX_VISIBLE = 2;
const EXIT_MS = 140;

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

function TimedToast({ entry, onDismiss }: { entry: Entry; onDismiss: (id: number) => void }) {
  const duration = entry.duration === undefined ? 6000 : entry.duration;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration ?? 0);
  const started = useRef(Date.now());

  useEffect(() => {
    if (duration === null || paused || entry.leaving) return;
    started.current = Date.now();
    const t = window.setTimeout(() => onDismiss(entry.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - started.current;
    };
  }, [duration, paused, entry.id, entry.leaving, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Toast
        {...entry}
        onClose={() => {
          entry.onClose?.();
          onDismiss(entry.id);
        }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, leaving: true } : e)));
    window.setTimeout(() => setEntries((list) => list.filter((e) => e.id !== id)), EXIT_MS);
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setEntries((list) => {
      const kept = toast.key ? list.filter((e) => e.key !== toast.key) : list;
      return [...kept, { ...toast, id }];
    });
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const visible = entries.filter((e) => !e.leaving).slice(-MAX_VISIBLE);
  const leaving = entries.filter((e) => e.leaving);
  const shown = entries.filter((e) => visible.includes(e) || leaving.includes(e));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport} aria-live="polite">
        {shown.map((e) => (
          <TimedToast key={e.id} entry={e} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
