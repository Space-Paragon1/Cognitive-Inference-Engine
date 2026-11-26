/**
 * Minimal HTTP client for the CLR engine (Node http/https, no dependencies).
 */

import * as http from "http";
import * as https from "https";

export interface EngineResponse {
  status: number;
  body: string;
}

export function engineRequest(
  engineUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, engineUrl);
    const lib = url.protocol === "https:" ? https : http;
    const data = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string | number> = {};
    if (data !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }
    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
    }

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method ?? "GET",
        headers,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on("error", reject);
    req.setTimeout(options.timeoutMs ?? 5000, () => req.destroy(new Error("timeout")));
    if (data !== undefined) req.write(data);
    req.end();
  });
}
