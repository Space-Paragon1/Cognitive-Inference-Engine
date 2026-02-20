/**
 * Telemetry client — buffers IdeEvents and flushes them to the CLR API.
 */

import * as https from "https";
import * as http from "http";
import { IdeEvent } from "./events";

export class TelemetryClient {
  private buffer: IdeEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private enabled: boolean = true;

  constructor(
    private engineUrl: string,
    private flushIntervalMs: number = 5000,
    private maxBufferSize: number = 50
  ) {
    this.startFlushTimer();
  }

  push(event: IdeEvent): void {
    if (!this.enabled) return;
    this.buffer.push(event);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setEngineUrl(url: string): void {
    this.engineUrl = url;
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.post("/telemetry/batch", batch);
    } catch {
      // Engine not running — silently discard
    }
  }

  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush().catch(() => {});
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  private post(path: string, body: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(path, this.engineUrl);
      const lib = url.protocol === "https:" ? https : http;

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          },
        },
        (res) => {
          res.resume();
          res.on("end", resolve);
        }
      );
      req.on("error", reject);
      req.setTimeout(3000, () => req.destroy());
      req.write(data);
      req.end();
    });
  }
}
