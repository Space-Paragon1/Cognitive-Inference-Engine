import { useEffect, useRef, useState } from "react";
import { createStateWebSocket, getState } from "../api/client";
import type { CognitiveState } from "../types";

const DEFAULT_STATE: CognitiveState = {
  load_score: 0,
  context: "unknown",
  confidence: 0,
  breakdown: { intrinsic: 0, extraneous: 0, germane: 0 },
  timestamp: 0,
};

export function useCognitiveState() {
  const [state, setState] = useState<CognitiveState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initial HTTP fetch while WS connects
    getState().then(setState).catch(() => {});

    const ws = createStateWebSocket((s) => {
      setState(s);
      setConnected(true);
    });

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3s
      setTimeout(() => {
        wsRef.current = null;
      }, 3000);
    };
    ws.onerror = () => setConnected(false);
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  return { state, connected };
}
