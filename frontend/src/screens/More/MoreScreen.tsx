/* More (phones only): History, Settings, Connected sources, Help; the theme switch;
   the account and sign out. */
import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, CircleHelp, Globe, History as HistoryIcon, LogOut, Settings as SettingsIcon } from "lucide-react";
import type { Icon } from "../../types/ui";
import { useAuth } from "../../auth/AuthContext";
import { usePrefs } from "../../live/PrefsState";
import { usePairing } from "../../live/usePairing";
import { fullDate, initials } from "../../lib/format";
import { SOURCE_ORDER } from "../../lib/domain";
import { navigate } from "../../lib/router";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ThemeSwitch } from "../../components/Settings";
import { Page } from "../../components/Shell";
import styles from "./MoreScreen.module.css";

function Row({ icon: I, title, sub, onClick, chevron = true }: { icon: Icon; title: string; sub?: ReactNode; onClick: () => void; chevron?: boolean }) {
  return (
    <li>
      <button type="button" className={styles.row} onClick={onClick}>
        <I size={20} aria-hidden="true" className={styles.icon} />
        <span className={styles.text}>
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </span>
        {chevron && <ChevronRight size={18} aria-hidden="true" className={styles.chev} />}
      </button>
    </li>
  );
}

export function MoreScreen() {
  const { user, logout } = useAuth();
  const { themeChoice, setThemeChoice } = usePrefs();
  const pairing = usePairing();
  const [help, setHelp] = useState(false);
  const connected = SOURCE_ORDER.filter((k) => pairing.stateFor(k) === "connected").length;

  return (
    <Page title="More">
      <div className={styles.stack}>
        <Card className={styles.listCard}>
          <ul className={styles.list}>
            <Row icon={HistoryIcon} title="History" sub="Replay sessions, event log" onClick={() => navigate("history")} />
            <Row icon={SettingsIcon} title="Settings" sub="Timers, thresholds, notifications" onClick={() => navigate("settings")} />
            <Row icon={Globe} title="Connected sources" sub={`${connected} of ${SOURCE_ORDER.length} connected`} onClick={() => navigate("settings", "sources")} />
            <Row icon={CircleHelp} title="Help and feedback" onClick={() => setHelp(true)} />
          </ul>
        </Card>

        <Card className={styles.listCard}>
          <div className={styles.themeRow}>
            <span>Theme</span>
            <ThemeSwitch value={themeChoice} onChange={setThemeChoice} />
          </div>
        </Card>

        <Card className={styles.listCard}>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(user?.email)}
            </span>
            <span className={styles.text}>
              <b>{user?.email}</b>
              {user?.created_at ? <small>Member since {fullDate(user.created_at * 1000)}</small> : null}
            </span>
          </div>
          <ul className={styles.list}>
            <Row icon={LogOut} title="Sign out" chevron={false} onClick={logout} />
          </ul>
        </Card>
      </div>

      <BottomSheet
        open={help}
        title="How CLR works"
        onClose={() => setHelp(false)}
        actions={
          <Button variant="secondary" onClick={() => setHelp(false)}>
            Done
          </Button>
        }
      >
        <div className={styles.help}>
          <p>CLR estimates how mentally loaded you are, every 2 seconds, from how you work. Then it adjusts your timers, your task order and your notifications.</p>
          <p>
            <b>What CLR reads:</b> tab and window switches (counts, not page content), typing rhythm and pauses, compile errors and their frequency, idle time and
            scrolling, LMS page visits.
          </p>
          <p>
            <b>What it never reads:</b> what you type, page text, grades, messages or passwords, your camera or microphone.
          </p>
          <p>You can export or delete your data any time in Settings, under Privacy.</p>
        </div>
      </BottomSheet>
    </Page>
  );
}
