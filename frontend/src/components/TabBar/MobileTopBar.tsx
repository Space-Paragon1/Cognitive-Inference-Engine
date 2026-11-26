import { ArrowLeft, Bell } from "lucide-react";
import type { ReactNode } from "react";
import type { CognitiveContext } from "../../types";
import type { ConnectionState } from "../../types/ui";
import { Button } from "../Button";
import { LoadGauge } from "../LoadGauge";
import styles from "./MobileTopBar.module.css";

interface Props {
  title: string;
  /** The h1 gets focus after navigation. */
  headingId?: string;
  load: number | null;
  context: CognitiveContext;
  confidence: number;
  status: ConnectionState;
  /** Show the back arrow (sub-pages under More). */
  onBack?: () => void;
  /** The pill opens Now. Hidden on Now itself, where the hero gauge is on screen. */
  onOpenNow?: () => void;
  onNotifications?: () => void;
  /** Replaces the pill and bell. */
  right?: ReactNode;
}

/** 56px mobile top bar: title, the live load pill and notifications. */
export function MobileTopBar({ title, headingId, load, context, confidence, status, onBack, onOpenNow, onNotifications, right }: Props) {
  return (
    <header className={[styles.top, onBack && styles.back].filter(Boolean).join(" ")}>
      {onBack && <Button variant="ghost" iconOnly icon={ArrowLeft} aria-label="Back" className={styles.backBtn} onClick={onBack} />}
      <h1 id={headingId} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      {right ?? (
        <>
          <LoadGauge variant="pill" load={load} context={context} confidence={confidence} status={status} onClick={onOpenNow} />
          {onNotifications && <Button variant="ghost" iconOnly icon={Bell} aria-label="Notifications" onClick={onNotifications} />}
        </>
      )}
    </header>
  );
}
