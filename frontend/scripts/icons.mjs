#!/usr/bin/env node
/**
 * Makes the web app's icons from the design system's mark
 * (design/assets/Logos/clr-mark.svg), so they never drift from it:
 *
 *   public/favicon.svg                 rounded tile, for browser tabs
 *   public/icons/favicon-32.png        the same, for browsers without SVG favicons
 *   public/icons/icon-{192,512}.png    rounded tile, for installed-app icons ("any")
 *   public/icons/maskable-{192,512}.png full-bleed tile; Android and others crop it
 *                                      to their own shape (the mark sits in the safe zone)
 *   public/icons/apple-touch-icon.png  full-bleed, 180 px; iOS rounds the corners itself
 *
 * Run from frontend/ after changing the mark: npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, "..");
const mark = readFileSync(join(frontend, "../design/assets/Logos/clr-mark.svg"), "utf8");

const TILE = '<rect width="108" height="108" fill="#0d0d1f"></rect>';
if (!mark.includes(TILE)) throw new Error("clr-mark.svg changed shape: update the tile match in scripts/icons.mjs");
// Corner radius in the mark's 108-unit space (about 22%, like a launcher icon).
const rounded = mark.replace(TILE, '<rect width="108" height="108" rx="24" fill="#0d0d1f"></rect>');

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

const pub = join(frontend, "public");
mkdirSync(join(pub, "icons"), { recursive: true });

writeFileSync(join(pub, "favicon.svg"), rounded.replace(/ width="216" height="216"/, ""));
const out = {
  "icons/favicon-32.png": png(rounded, 32),
  "icons/icon-192.png": png(rounded, 192),
  "icons/icon-512.png": png(rounded, 512),
  "icons/maskable-192.png": png(mark, 192),
  "icons/maskable-512.png": png(mark, 512),
  "icons/apple-touch-icon.png": png(mark, 180),
};
for (const [file, data] of Object.entries(out)) writeFileSync(join(pub, file), data);

console.log(`Wrote favicon.svg and ${Object.keys(out).length} PNG icons to ${pub}`);
