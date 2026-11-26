/* The top-bar save indicator: "Saving…", "Saved", "Will save when you are back online"
   or "Couldn't save" with Retry. Announced politely. */
import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { useSettings } from "../../live/SettingsState";
import styles from "./SaveStatus.module.css";

export function SaveStatus() {
  const { saveState, retry } = useSettings();
  let body = null;
  if (saveState === "saving") {
    body = (
      <span className={styles.status} data-tone="neutral">
        <Loader2 size={14} aria-hidden="true" className={styles.spin} />
        Saving…
      </span>
    );
  } else if (saveState === "saved") {
    body = (
      <span className={styles.status} data-tone="positive">
        <Check size={14} aria-hidden="true" />
        Saved
      </span>
    );
  } else if (saveState === "queued") {
    body = (
      <span className={styles.status} data-tone="caution">
        <CloudOff size={14} aria-hidden="true" />
        Saves when you are back online
      </span>
    );
  } else if (saveState === "error") {
    body = (
      <span className={styles.status} data-tone="critical">
        <TriangleAlert size={14} aria-hidden="true" />
        Couldn't save
        <button type="button" className={styles.retry} onClick={retry}>
          Retry
        </button>
      </span>
    );
  }
  return (
    <span role="status" aria-live="polite" className={styles.wrap}>
      {body}
    </span>
  );
}
