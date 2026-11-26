import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import type { SourceCardProps } from "../../types/ui";
import { SOURCES } from "../../lib/domain";
import { mmss } from "../../lib/format";
import { Button } from "../Button";
import { Spinner } from "../Spinner";
import styles from "./SourceCard.module.css";

type Props = SourceCardProps & {
  /** Primary Connect button (the recommended source in onboarding). */
  primary?: boolean;
  /** Override the one-line description. */
  desc?: string;
  /** Busy while a pairing code is being created. */
  connecting?: boolean;
};

/** One data source: not connected, waiting with a pairing code, or connected. */
export function SourceCard({
  kind,
  state,
  code,
  codeExpiresIn,
  lastSeen,
  recommended,
  optional,
  onConnect,
  onCancel,
  onDisconnect,
  primary,
  desc,
  connecting,
}: Props) {
  const s = SOURCES[kind];
  const Icon = s.icon;
  const [left, setLeft] = useState(codeExpiresIn ?? 0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLeft(codeExpiresIn ?? 0);
    if (state !== "waiting" || !codeExpiresIn) return;
    const end = Date.now() + codeExpiresIn * 1000;
    const t = window.setInterval(() => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(t);
  }, [state, code, codeExpiresIn]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={[styles.source, state === "connected" && styles.connected].filter(Boolean).join(" ")}>
      <span className={styles.icon} aria-hidden="true">
        <Icon size={22} />
      </span>
      <div>
        <p className={styles.name}>
          {s.label}
          {recommended && <span className={styles.badge}>Recommended</span>}
          {optional && <span className={styles.optional}>Optional</span>}
        </p>
        <p className={styles.desc}>{desc ?? s.desc}</p>
      </div>
      <div className={styles.state}>
        {state === "connected" && (
          <div className={styles.between}>
            <span className={styles.status} role="status">
              <b aria-hidden="true" />
              Connected{lastSeen ? ` · last seen ${lastSeen} ago` : ""}
            </span>
            {onDisconnect && (
              <Button variant="ghost" size="sm" onClick={onDisconnect}>
                Disconnect
              </Button>
            )}
          </div>
        )}
        {state === "waiting" && (
          <>
            <div className={styles.code} aria-label={code ? `Pairing code ${code.split("").join(" ")}` : "Pairing code"}>
              <span aria-hidden="true">{code}</span>
              <Button variant="ghost" iconOnly icon={copied ? Check : Copy} aria-label={copied ? "Copied" : "Copy code"} onClick={copy} />
            </div>
            <div className={styles.between}>
              <span className={styles.waiting} role="status">
                <span>
                  <Spinner size={14} />
                </span>
                {copied ? "Copied. " : ""}
                {left > 0 ? (
                  <>
                    Waiting for {s.label}… code expires in {mmss(left)}
                  </>
                ) : (
                  "This code has expired. Get a new one."
                )}
              </span>
              {left > 0
                ? onCancel && (
                    <Button variant="ghost" size="sm" onClick={onCancel}>
                      Cancel
                    </Button>
                  )
                : onConnect && (
                    <Button variant="secondary" size="sm" onClick={onConnect}>
                      New code
                    </Button>
                  )}
            </div>
          </>
        )}
        {state === "not_connected" && onConnect && (
          <div>
            <Button variant={primary ? "primary" : "secondary"} size="sm" iconRight={ArrowRight} loading={connecting} loadingLabel="Getting a code…" onClick={onConnect}>
              Connect
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
