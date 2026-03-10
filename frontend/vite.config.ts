import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendProxy = {
  target: "http://127.0.0.1:8765",
};

const proxyConfig = {
  "/api": {
    ...backendProxy,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
  "/auth": backendProxy,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: proxyConfig,
  },
  preview: {
    port: 4173,
    proxy: proxyConfig,
  },
});
