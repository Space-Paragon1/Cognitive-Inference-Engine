import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { BottomSheetProps } from "../../types/ui";
import { useBackHandler } from "../../lib/backStack";
import { Button } from "../Button";
import styles from "./BottomSheet.module.css";

type Props = BottomSheetProps & {
  /** false for destructive confirmations: Esc, the scrim and the X don't close it, only Cancel does. */
  dismissible?: boolean;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EXIT_MS = 240;

/** Bottom sheet on phones, centred dialog at 768px and up. Traps focus and returns it to the trigger. */
export function BottomSheet({ open, title, children, actions, onClose, dismissible = true }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      trigger.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
      trigger.current?.focus?.();
    }, EXIT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the first field (or the first control) once the panel is in the DOM.
  useEffect(() => {
    if (!open || !mounted) return;
    const el = panel.current;
    if (!el) return;
    const field = el.querySelector<HTMLElement>("input, textarea, select");
    const first = field ?? el.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el).focus();
  }, [open, mounted]);

  // Lock page scroll behind the sheet.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // Android back closes the sheet.
  useBackHandler(open, onClose);

  if (!mounted) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className={[styles.layer, closing && styles.closing].filter(Boolean).join(" ")} onKeyDown={onKeyDown}>
      <div className={styles.scrim} aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        ref={panel}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className={styles.grab} aria-hidden="true" />
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {dismissible && <Button variant="ghost" iconOnly icon={X} aria-label="Close" onClick={onClose} />}
        </div>
        {children}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>,
    document.body
  );
}
