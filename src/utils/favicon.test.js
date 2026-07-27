/**
 * src/utils/favicon.test.js — gate test keeping the browser-tab icon on-brand and self-contained.
 *
 * Three silent failures this prevents:
 *
 * 1. Regression to the Vite default. `public/vite.svg` keeps the framework's filename, so a
 *    `npm create vite` scaffold, a merge, or a "restore the default" cleanup can put the purple
 *    Vite logo back with nothing failing. Every browser caches favicons aggressively, so the
 *    wrong icon can sit in users' tabs for days before anyone notices.
 * 2. A broken `href`. Renaming or moving the asset without touching index.html yields a 404 that
 *    the browser swallows — the tab just shows a blank page glyph. The build stays green.
 * 3. An icon that is not self-contained. A <script>, a remote <image href>, or an external font
 *    inside an SVG favicon is a request the CSP will block (and a script tag is an XSS surface),
 *    but it renders fine from the dev server, so it survives local review.
 *
 * Pure filesystem + regex. No network, no DOM, no build.
 */

import fs from "node:fs";
import path from "node:path";

// NOT `import.meta.url` — see the note in envCoherence.test.js: jest rewrites `import.meta`
// to a stub, leaving `.url` undefined. Babel's CommonJS transform gives us __dirname.
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(REPO_ROOT, "index.html");
const FAVICON = path.join(REPO_ROOT, "public", "vite.svg");

/**
 * Canonical brand oranges, as used by src/App.css (the button gradient) and src/index.css.
 * The favicon must draw from this pair so the tab matches the app chrome.
 */
const BRAND_ORANGES = ["#f97316", "#ea580c"];

/** Colours that only appear in the stock Vite logo. Their presence means the default came back. */
const VITE_LOGO_COLOURS = ["#41d1ff", "#bd34fe", "#ffea83", "#ffdd35", "#ffa800"];

const html = fs.readFileSync(INDEX_HTML, "utf8");
const svg = fs.readFileSync(FAVICON, "utf8");
const svgLower = svg.toLowerCase();

describe("index.html favicon wiring", () => {
  test("declares exactly one SVG icon link", () => {
    const links = html.match(/<link[^>]*rel=["']icon["'][^>]*>/gi) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toMatch(/type=["']image\/svg\+xml["']/i);
  });

  test("points at /vite.svg, and that file exists in public/", () => {
    const href = html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i)?.[1];
    // The path is deliberately kept as /vite.svg: it is already cached by returning
    // visitors and referenced by the built dist/. Only the artwork changed.
    expect(href).toBe("/vite.svg");
    // Vite serves public/ at the root, so /vite.svg resolves to public/vite.svg.
    expect(fs.existsSync(FAVICON)).toBe(true);
  });
});

describe("public/vite.svg artwork", () => {
  test("is a well-formed standalone SVG document", () => {
    expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
    expect(svgLower).toContain('xmlns="http://www.w3.org/2000/svg"');
    // A viewBox is what lets one file serve 16px tabs and 180px touch icons alike.
    expect(svgLower).toMatch(/viewbox=["'][^"']+["']/);
  });

  test("uses the Drop 'N Roll orange, not the stock Vite palette", () => {
    for (const colour of BRAND_ORANGES) {
      expect(svgLower).toContain(colour);
    }
    for (const colour of VITE_LOGO_COLOURS) {
      expect(svgLower).not.toContain(colour);
    }
    // The scaffold ships Iconify-generated gradient ids; theirs, ours never.
    expect(svgLower).not.toContain("iconifyid");
  });

  test("is self-contained: no scripts, no external references", () => {
    expect(svgLower).not.toContain("<script");
    expect(svgLower).not.toContain("<foreignobject");
    expect(svgLower).not.toMatch(/\bon[a-z]+\s*=/); // inline event handlers
    // Any href/src pointing off-document is a request a strict CSP will block.
    expect(svgLower).not.toMatch(/(href|src)\s*=\s*["'](https?:)?\/\//);
    expect(svgLower).not.toContain("@import");
  });

  test("stays small enough to be a cheap first-paint request", () => {
    // The stock Vite logo is ~1.5 KB; anything past 4 KB means a raster got embedded.
    expect(Buffer.byteLength(svg, "utf8")).toBeLessThan(4096);
  });

  test("carries an accessible label for the tab and bookmark UI", () => {
    expect(svgLower).toMatch(/aria-label=["'][^"']+["']|<title>/);
  });
});
