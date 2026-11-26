import { useEffect, useState } from "react";

/** True only after `flag` has stayed true for `delay` ms. Skeletons wait 300 ms so fast loads never flash. */
export function useDelayedFlag(flag: boolean, delay = 300): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(t);
  }, [flag, delay]);
  return flag && shown;
}
