/* A card's load failure. Offline it says so plainly (nothing is wrong on either
   side); otherwise it is voice.md's "Something went wrong on our side" pattern.
   Either way the data is safe and there is a way to try again. */
import { RefreshCw, WifiOff } from "lucide-react";
import { useLive } from "../../live/LiveState";
import { Button } from "../Button";
import { EmptyState } from "../EmptyState";

interface Props {
  title: string;
  body: string;
  /** What loads once back online, e.g. "Your insights load". */
  offlineWhat: string;
  onRetry: () => void;
  compact?: boolean;
  level?: 2 | 3 | 4;
}

export function LoadError({ title, body, offlineWhat, onRetry, compact = false, level }: Props) {
  const offline = useLive((s) => s.status === "offline");
  const retry = (
    <Button variant="secondary" size={compact ? "sm" : "md"} icon={RefreshCw} onClick={onRetry}>
      Try again
    </Button>
  );
  if (offline) {
    return (
      <EmptyState
        compact={compact}
        level={level}
        tone="neutral"
        icon={WifiOff}
        title="You are offline."
        body={`${offlineWhat} when you are back online. Timers and tasks still work.`}
        actions={retry}
      />
    );
  }
  return <EmptyState compact={compact} level={level} tone="critical" icon={RefreshCw} title={title} body={body} actions={retry} />;
}
