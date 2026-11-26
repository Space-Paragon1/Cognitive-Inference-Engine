/* The weekly reflection: two or three sentences about the week, with feedback.
   Marked Preview: the design calls for an AI-written reflection, which needs an
   engine endpoint; until then it is written from the week's numbers by rules. */
import { useState } from "react";
import { PenLine } from "lucide-react";
import type { Reflection } from "../../lib/insights";
import { navigate } from "../../lib/router";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Card } from "../Card";
import { useToast } from "../Toast";
import styles from "./WeeklyReflection.module.css";

const HIDDEN_KEY = "clr_reflection_hidden";

function readHidden(week: string) {
  try {
    return localStorage.getItem(HIDDEN_KEY) === week;
  } catch {
    return false;
  }
}

export function WeeklyReflection({ reflection, week }: { reflection: Reflection | null; week: string }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(() => readHidden(week));

  const notHelpful = () => {
    // TODO(backend): send the feedback so reflections can improve.
    try {
      localStorage.setItem(HIDDEN_KEY, week);
    } catch {
      /* storage blocked: hidden for this visit */
    }
    setHidden(true);
    toast.show({
      title: "Thanks for telling us.",
      body: "This week's reflection is hidden.",
      actions: [{ label: "Undo", onClick: () => setHidden(false) }],
    });
  };

  const title = (
    <>
      <PenLine size={18} aria-hidden="true" className={styles.icon} />
      Weekly reflection
    </>
  );

  if (hidden) {
    return (
      <Card title={title} titleId="reflection-title" className={styles.card}>
        <p className={styles.sub}>Hidden for this week.</p>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={() => setHidden(false)}>
            Show it again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={title} titleId="reflection-title" meta={<Badge>Preview</Badge>} className={styles.card}>
      {reflection ? (
        <>
          <p className={styles.lead}>
            {reflection.window && (
              <>
                You focus best between <b>{reflection.window}</b>.{" "}
              </>
            )}
            {reflection.strongest}
          </p>
          {reflection.more && <p className={styles.more}>{reflection.more}</p>}
          <p className={styles.sub}>Written from your week’s data. Never shared.</p>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => navigate("tasks")}>
              Plan next week
            </Button>
            <Button variant="ghost" size="sm" onClick={notHelpful}>
              Not helpful
            </Button>
          </div>
        </>
      ) : (
        <p className={styles.more}>Your reflection appears after a few tracked sessions this week.</p>
      )}
    </Card>
  );
}
