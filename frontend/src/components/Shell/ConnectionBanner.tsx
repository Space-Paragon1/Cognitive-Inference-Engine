import { CircleDashed, RefreshCw, WifiOff } from "lucide-react";
import { useGaugeState, useLiveStore } from "../../live/LiveState";
import { clock } from "../../lib/format";
import { Banner } from "../Banner";

interface Props {
  /** What still works while offline, per screen. */
  offlineBody?: string;
  reconnectingBody?: string;
  /** Show "Still learning how you work today." under 50% confidence (Now). */
  lowConfidence?: boolean;
}

/** The connection banner every screen shows while stale (handoff.md state matrix). */
export function ConnectionBanner({ offlineBody, reconnectingBody, lowConfidence = false }: Props) {
  const g = useGaugeState();
  const store = useLiveStore();
  if (g.status === "reconnecting") {
    return (
      <Banner
        tone="caution"
        icon={RefreshCw}
        title="Reconnecting…"
        body={reconnectingBody ?? (g.lastReadingAt ? `Showing your last reading from ${clock(g.lastReadingAt)}.` : undefined)}
      />
    );
  }
  if (g.status === "offline") {
    return (
      <Banner
        tone="neutral"
        icon={WifiOff}
        title="You are offline."
        body={offlineBody ?? "Timers and tasks still work. Live load is paused."}
        action={{ label: "Retry", onClick: store.retry }}
      />
    );
  }
  if (lowConfidence && g.load != null && g.confidence < 0.5) {
    return <Banner context="unknown" icon={CircleDashed} title="Still learning how you work today." body="Estimates firm up after about 2 minutes." />;
  }
  return null;
}
