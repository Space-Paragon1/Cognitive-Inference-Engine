import { useEffect, useState } from "react";
import { createStateWebSocket, getState } from "../api/client";
import type { CognitiveState } from "../types";

const DEFAULT_STATE: CognitiveState = {
  load_score: 0,
  context: "unknown",
  confidence: 0,
  breakdown: { intrinsic: 0, extraneous: 0, germane: 0 },
  timestamp: 0,
};

const RECONNECT_MS = 3000;

export function useCognitiveState() {
  const [state, setState] = useState<CognitiveState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    // Initial HTTP fetch while the socket connects
    getState().then(setState).catch(() => {});

    const connect = () => {
      ws = createStateWebSocket((s) => {
        setState(s);
        setConnected(true);
      });
      ws.onclose = (e) => {
        setConnected(false);
        // 4001 = bad/expired token: reconnecting won't help until the user signs in again.
        if (!disposed && e.code !== 4001) retry = setTimeout(connect, RECONNECT_MS);
      };
      ws.onerror = () => setConnected(false);
    };
    connect();

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return { state, connected };
}
