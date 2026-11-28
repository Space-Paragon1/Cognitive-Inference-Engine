import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig } from "vite";
import type { Plugin, ResolvedConfig } from "vite";
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

/** The files that make up the app shell, saved by the service worker on install:
    the page, its scripts and styles, the manifest and icons, and the Latin font files.
    Other font alphabets are saved the first time they are used. */
function isShell(file: string) {
  if (file === "sw.js" || file.endsWith(".map")) return false;
  return (
    file === "index.html" ||
    file === "manifest.webmanifest" ||
    file === "favicon.svg" ||
    file.startsWith("icons/") ||
    /\.(js|css)$/.test(file) ||
    /-latin-\d+-normal-[\w-]+\.woff2$/.test(file)
  );
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** Writes dist/sw.js from sw/sw.js with the shell's files and a version made from
    their contents, so every release that changes the app installs fresh. */
function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "clr-service-worker",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    writeBundle(_options, bundle) {
      const files = new Map<string, string | Uint8Array>();
      for (const [name, out] of Object.entries(bundle)) files.set(name, out.type === "chunk" ? out.code : out.source);
      if (config.publicDir) {
        for (const path of listFiles(config.publicDir)) {
          files.set(relative(config.publicDir, path).split("\\").join("/"), readFileSync(path));
        }
      }
      const shell = [...files.keys()].filter(isShell).sort();
      const hash = createHash("sha256");
      for (const file of shell) hash.update(file).update(files.get(file)!);
      const source = readFileSync(join(config.root, "sw/sw.js"), "utf8")
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace("__SHELL__", JSON.stringify(shell.map((f) => `/${f}`)));
      writeFileSync(join(config.root, config.build.outDir, "sw.js"), source);
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    port: 5173,
    proxy: proxyConfig,
  },
  preview: {
    port: 4173,
    proxy: proxyConfig,
  },
});
