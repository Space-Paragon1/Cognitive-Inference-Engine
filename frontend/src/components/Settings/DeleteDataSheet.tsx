/* "Delete everything?": the student types DELETE to arm the button. "Keep my data"
   is the safe default and closes the sheet. */
import { useEffect, useState } from "react";
import { deleteMyData, NotAvailableError } from "../../api/privacy";
import { Banner } from "../Banner";
import { BottomSheet } from "../BottomSheet";
import { Button } from "../Button";
import { TextField } from "../TextField";
import styles from "./DeleteDataSheet.module.css";

export function DeleteDataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"unavailable" | "failed" | null>(null);
  const armed = typed.trim() === "DELETE";

  useEffect(() => {
    if (!open) {
      setTyped("");
      setError(null);
    }
  }, [open]);

  const confirm = async () => {
    if (!armed) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyData();
    } catch (e) {
      setError(e instanceof NotAvailableError ? "unavailable" : "failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      title="Delete everything?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep my data
          </Button>
          <Button variant="danger" disabled={!armed} loading={busy} onClick={confirm}>
            Delete forever
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <p className={styles.text}>This permanently removes your sessions, events, tasks and settings from CLR. Your account email goes too. This cannot be undone.</p>
        <TextField
          label="Type DELETE to confirm"
          value={typed}
          onChange={setTyped}
          valid={armed}
          help={armed ? "Confirmed." : undefined}
          autoComplete="off"
        />
        {error === "unavailable" && <Banner tone="critical" title="Couldn't delete your data." body="This needs an update on our side. Nothing was removed." />}
        {error === "failed" && <Banner tone="critical" title="Couldn't delete your data." body="Check your connection. Nothing was removed." />}
      </div>
    </BottomSheet>
  );
}
