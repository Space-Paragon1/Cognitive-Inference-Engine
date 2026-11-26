import { WifiOff } from "lucide-react";
import type { ConnectionStatusProps, SourceKind } from "../../types/ui";
import { SOURCE_ORDER, SOURCES } from "../../lib/domain";
import styles from "./ConnectionStatus.module.css";

type Props = ConnectionStatusProps & {
  /** Which source chips to show. Default: all four. */
  kinds?: SourceKind[];
};

const LABEL = { live: "Live", reconnecting: "Reconnecting…", offline: "Offline" } as const;

function seenText(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

/** Live / Reconnecting… / Offline plus which sources are sending right now. */
export function ConnectionStatus({ status, sources, lastSeenSeconds, kinds = SOURCE_ORDER }: Props) {
  const badge = (
    <span
      className={[styles.conn, status === "offline" && styles.offline].filter(Boolean).join(" ")}
      data-tone={status === "live" ? "positive" : status === "reconnecting" ? "caution" : undefined}
    >
      {status === "live" && <span className={styles.dot} aria-hidden="true" />}
      {status === "reconnecting" && <span className={styles.ring} aria-hidden="true" />}
      {status === "offline" && <WifiOff size={14} aria-hidden="true" />}
      {LABEL[status]}
    </span>
  );

  return (
    <div className={styles.wrap} role="status">
      {badge}
      {status !== "live" && lastSeenSeconds != null && (
        <span className={styles.seen}>Last reading {seenText(lastSeenSeconds)} ago</span>
      )}
      {sources && (
        <ul className={styles.sources} aria-label="Sources">
          {kinds.map((k) => {
            const on = !!sources[k];
            return (
              <li key={k} className={[styles.source, !on && styles.off].filter(Boolean).join(" ")}>
                <b aria-hidden="true" />
                {SOURCES[k].label}
                {!on && <span className="sr-only"> not connected</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
