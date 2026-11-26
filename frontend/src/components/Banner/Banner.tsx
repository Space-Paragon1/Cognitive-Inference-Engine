import { Info, X } from "lucide-react";
import type { BannerProps } from "../../types/ui";
import { toneAttrs } from "../../lib/domain";
import { Button } from "../Button";
import styles from "./Banner.module.css";

/** Inline notice above the content it describes. Errors (critical) use role="alert". */
export function Banner({ title, body, icon: Icon = Info, tone = "accent", context, action, onClose }: BannerProps) {
  return (
    <div className={styles.banner} {...toneAttrs(tone, context)} role={tone === "critical" ? "alert" : "status"}>
      <Icon size={20} className={styles.icon} aria-hidden="true" />
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {body && <span className={styles.body}> {body}</span>}
      </div>
      {action && (
        <Button variant="ghost" size="sm" className={styles.action} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {onClose && <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Dismiss" onClick={onClose} />}
    </div>
  );
}
