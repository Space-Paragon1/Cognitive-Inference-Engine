import { useEffect, useRef, useState } from "react";
import { getSettings, putSettings } from "../../api/client";
import type { Settings } from "../../types";
import css from "./Settings.module.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtSeconds(s: number): string {
  const m = Math.round(s / 60);
  return m === 1 ? "1 min" : `${m} min`;
}

function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ── SliderRow ────────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderRow({ label, hint, min, max, step, value, format, onChange }: SliderRowProps) {
  return (
    <div className={css.row}>
      <div className={css.rowHeader}>
        <span className={css.label}>{label}</span>
        <span className={css.value}>{format(value)}</span>
      </div>
      <span className={css.hint}>{hint}</span>
      <input
        type="range"
        className={css.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState<Settings | null>(null);
  // baseline = what the server currently has (updated after each successful save)
  const [baseline, setBaseline] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load current settings on mount
  useEffect(() => {
    getSettings()
      .then(({ settings, defaults: defs }) => {
        setDraft(settings);
        setBaseline(settings);
        setDefaults(defs);
      })
      .catch(() => {});
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSaved(false);
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await putSettings(draft);
      setDraft(res.settings);
      setBaseline(res.settings);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (defaults) { setDraft({ ...defaults }); setSaved(false); }
  };

  const isDirty = draft && baseline
    ? JSON.stringify(draft) !== JSON.stringify(baseline)
    : false;

  if (!draft || !baseline) {
    return (
      <>
        <div className={css.backdrop} onClick={onClose} />
        <div className={css.drawer}>
          <div className={css.header}>
            <span className={css.title}>Settings</span>
            <button type="button" className={css.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div className={css.body} style={{ alignItems: "center", justifyContent: "center", opacity: 0.3, fontSize: 13 }}>
            Loading…
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={css.backdrop} onClick={onClose} />
      <div className={css.drawer}>
        <div className={css.header}>
          <span className={css.title}>Settings</span>
          <button type="button" className={css.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={css.body}>
          {/* Pomodoro */}
          <div className={css.section}>
            <div className={css.sectionTitle}>Pomodoro breaks</div>
            <SliderRow
              label="Short break"
              hint="After each focus session"
              min={60} max={900} step={60}
              value={draft.short_break_seconds}
              format={fmtSeconds}
              onChange={(v) => set("short_break_seconds", v)}
            />
            <SliderRow
              label="Long break"
              hint="After every 4 sessions"
              min={300} max={3600} step={60}
              value={draft.long_break_seconds}
              format={fmtSeconds}
              onChange={(v) => set("long_break_seconds", v)}
            />
          </div>

          {/* Load thresholds */}
          <div className={css.section}>
            <div className={css.sectionTitle}>Load thresholds</div>
            <SliderRow
              label="High load"
              hint="Load above this triggers high-load task ordering"
              min={0.5} max={0.9} step={0.05}
              value={draft.high_load_threshold}
              format={fmtPct}
              onChange={(v) => set("high_load_threshold", v)}
            />
            <SliderRow
              label="Fatigue / overload"
              hint="Load above this fires an overload notification"
              min={0.6} max={0.99} step={0.05}
              value={draft.fatigue_threshold}
              format={fmtPct}
              onChange={(v) => set("fatigue_threshold", v)}
            />
          </div>

          {/* Session detection */}
          <div className={css.section}>
            <div className={css.sectionTitle}>Session detection</div>
            <SliderRow
              label="Session gap"
              hint="Idle gap that splits two sessions apart"
              min={2} max={60} step={1}
              value={draft.session_gap_minutes}
              format={(v) => `${v} min`}
              onChange={(v) => set("session_gap_minutes", v)}
            />
          </div>
        </div>

        <div className={css.footer}>
          <button type="button" className={css.resetBtn} onClick={handleReset}>
            Reset
          </button>
          <button
            type="button"
            className={css.saveBtn}
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className={css.savedMsg}>Saved</span>}
        </div>
      </div>
    </>
  );
}
