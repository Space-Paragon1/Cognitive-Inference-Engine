/* The section list on the left of Settings (desktop) or a scrolling row of links
   (tablet). The section in view is marked aria-current. */
import { href } from "../../lib/router";
import { SECTIONS, sectionDomId } from "./SettingsPanel";
import type { SectionId } from "./SettingsPanel";
import styles from "./SettingsNav.module.css";

export function SettingsNav({ current, onPick }: { current: SectionId; onPick: (id: SectionId) => void }) {
  return (
    <nav className={styles.nav} aria-label="Settings sections">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={href("settings", id)}
          aria-current={current === id || undefined}
          aria-controls={sectionDomId(id)}
          onClick={(e) => {
            e.preventDefault();
            onPick(id);
          }}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  );
}
