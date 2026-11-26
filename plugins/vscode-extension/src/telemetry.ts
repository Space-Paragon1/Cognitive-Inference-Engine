/**
 * Telemetry client — buffers IdeEvents and flushes them to the CLR API
 * with this device's token.
 */

import { engineRequest } from "./engineClient";
import { IdeEvent } from "./events";

const MAX_BUFFER = 500; // engine limit per batch

export class TelemetryClient {
  private buffer: IdeEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private enabled = true;
  private flushing = false;

  constructor(
    private engineUrl: string,
    private getToken: () => Promise<string | undefined>,
    private onUnauthorized: () => void,
    private flushIntervalMs: number = 5000,
    private flushAt: number = 50
  ) {
    this.startFlushTimer();
  }

  push(event: IdeEvent): void {
    if (!this.enabled) return;
    this.buffer.push(event);
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
    }
    if (this.buffer.length >= this.flushAt) {
      void this.flush();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.buffer = [];
  }

  setEngineUrl(url: string): void {
    this.engineUrl = url;
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    const token = await this.getToken();
    if (!token) {
      // Not connected: don't hold on to activity data for nobody.
      this.buffer = [];
      return;
    }
    this.flushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      const res = await engineRequest(this.engineUrl, "/telemetry/batch", {
        method: "POST",
        token,
        body: batch,
      });
      if (res.status === 401) {
        this.onUnauthorized();
      } else if (res.status >= 500) {
        this.requeue(batch);
      }
      // Other 4xx: the batch itself was bad — drop it.
    } catch {
      this.requeue(batch); // engine unreachable — retry next flush
    } finally {
      this.flushing = false;
    }
  }

  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush().catch(() => {});
  }

  private requeue(batch: IdeEvent[]): void {
    this.buffer = batch.concat(this.buffer).slice(-MAX_BUFFER);
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => void this.flush(), this.flushIntervalMs);
  }
}
