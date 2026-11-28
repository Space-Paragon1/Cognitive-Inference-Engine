// Checks that every extension ships the same default engine and web app
// addresses, and that the LMS connector's clr-client.js is still a copy of the
// browser extension's. Run from the repo root: node plugins/scripts/check-defaults.mjs
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const problems = [];

function pick(file, re, what) {
  const m = read(file).match(re);
  if (!m) {
    problems.push(`${file}: could not find ${what}`);
    return undefined;
  }
  return m[1];
}

// The two clr-client.js files differ only in the NOTE line that says which is the copy.
const withoutNote = (p) =>
  read(p)
    .split("\n")
    .filter((line) => !line.startsWith(" * NOTE:"))
    .join("\n");
if (
  withoutNote("plugins/browser-extension/clr-client.js") !==
  withoutNote("plugins/lms-connector/clr-client.js")
) {
  problems.push(
    "plugins/lms-connector/clr-client.js is no longer a copy of plugins/browser-extension/clr-client.js",
  );
}

const client = "plugins/browser-extension/clr-client.js";
const engine = pick(client, /engineUrl:\s*"([^"]+)"/, "CLR_DEFAULTS.engineUrl");
const web = pick(client, /dashboardUrl:\s*"([^"]+)"/, "CLR_DEFAULTS.dashboardUrl");

const pkg = JSON.parse(read("plugins/vscode-extension/package.json"));
const props = pkg.contributes.configuration.properties;
const ts = "plugins/vscode-extension/src/extension.ts";
const content = "plugins/browser-extension/content.js";

const expect = [
  [content, pick(content, /const DEFAULT_ENGINE = "([^"]+)"/, "DEFAULT_ENGINE"), engine],
  [content, pick(content, /const DEFAULT_DASHBOARD = "([^"]+)"/, "DEFAULT_DASHBOARD"), web],
  [ts, pick(ts, /const DEFAULT_ENGINE_URL = "([^"]+)"/, "DEFAULT_ENGINE_URL"), engine],
  [ts, pick(ts, /const DEFAULT_DASHBOARD_URL = "([^"]+)"/, "DEFAULT_DASHBOARD_URL"), web],
  ["plugins/vscode-extension/package.json (clr.engineUrl)", props["clr.engineUrl"]?.default, engine],
  ["plugins/vscode-extension/package.json (clr.dashboardUrl)", props["clr.dashboardUrl"]?.default, web],
];
for (const [where, got, want] of expect) {
  if (got !== undefined && got !== want) problems.push(`${where}: ${got} should be ${want}`);
}

// Both Chrome extensions need permission to reach the default engine.
for (const dir of ["browser-extension", "lms-connector"]) {
  const manifest = JSON.parse(read(`plugins/${dir}/manifest.json`));
  if (engine && !manifest.host_permissions.includes(`${engine}/*`)) {
    problems.push(`plugins/${dir}/manifest.json: host_permissions is missing ${engine}/*`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Extension defaults agree: engine ${engine}, web app ${web}`);
