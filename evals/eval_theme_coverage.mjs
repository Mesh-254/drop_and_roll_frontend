#!/usr/bin/env node
/**
 * evals/eval_theme_coverage.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 * Does every route render coherently in BOTH themes?
 *
 * WHY A BROWSER. The gate tests prove the token values clear AA
 * (styles/themeContrast.test.js) and that no component names a raw colour
 * (styles/noRawColors.test.js). Neither can prove a RENDERED page has no
 * half-themed corner, because that depends on which element ends up inside
 * which — a dark card nested in a light page is a DOM fact, not a palette fact.
 *
 * Deterministic despite living in the slow lane: it reads computed styles and
 * does arithmetic. That is strictly better than asking a model to eyeball a
 * screenshot, so no model is asked.
 *
 * TWO FINDINGS
 *   contrast  a text node whose computed colour, against its effective
 *             background, falls below AA (4.5:1, or 3:1 for large text).
 *   mixed     an element whose own background sits on the wrong side of the
 *             theme it is rendering in — a light surface in dark mode or vice
 *             versa. This is exactly the half-flip that removed the toggle in
 *             9e8d481, detected structurally rather than by opinion.
 *
 * Scrims are excluded from `mixed`: --overlay is a dark wash in BOTH themes by
 * design, which is what a scrim is for.
 *
 *   npm run dev
 *   npm run eval:theme
 */

import { writeFileSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { relativeLuminance } from "../src/styles/colorMath.js";

const BASE = process.env.EVAL_BASE_URL ?? "http://localhost:5173";
const CHROME =
  process.env.CHROME_PATH ?? "/usr/bin/google-chrome";

// Public routes. The authenticated ones need a session; see the note at the end.
const ROUTES = [
  "/",
  "/faqs",
  "/login",
  "/register",
  "/forgot-password",
  "/check-email",
  "/email-confirmation",
  "/account-confirmed",
  "/resend-confirmation",
  "/quote",
  "/booking",
  "/pay/cancel",
  "/billing",
  "/history",
  "/driver-dashboard",
];

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/** "rgb(r, g, b)" -> linear triple, for relativeLuminance. */
function parseRgb(str) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(str);
  if (!m) return null;
  // A fully transparent colour tells us nothing about what is painted.
  if (m[4] !== undefined && Number(m[4]) === 0) return null;
  return [m[1], m[2], m[3]]
    .map((v) => Number(v) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
}

/** Alpha of a computed colour, 1 when unstated. */
function alphaOf(str) {
  const m = /rgba?\([^)]*,\s*([\d.]+)\s*\)/.exec(str ?? "");
  return m ? Number(m[1]) : 1;
}

function ratio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Collect text colour and effective background for every visible element. */
const COLLECT = `(() => {
  const out = [];
  const isTransparent = (c) =>
    !c || c === "transparent" || /rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(c);

  /*
   * Markup we do not author, and therefore cannot theme. Google's Sign-In
   * widget renders its own button with obfuscated class names
   * (nsm7Bb-HzV7m-LgbsSe ...) and its own dark-on-light styling; the first run
   * of this eval reported it as a dark surface in the light theme on five
   * routes. Flagging it would be reporting Google's design as our bug.
   */
  const THIRD_PARTY = '[class*="nsm7Bb"], [id^="credential_picker"], [id^="gsi_"], iframe, .StripeElement, [class*="__PrivateStripeElement"]';
  const isThirdParty = (el) => !!el.closest(THIRD_PARTY);
  const effectiveBg = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (!isTransparent(bg)) return bg;
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute("class") || "").slice(0, 90),
      text: ownText.slice(0, 40),
      hasText: ownText.length > 0,
      color: style.color,
      bg: style.backgroundColor,
      effBg: effectiveBg(el),
      fontSize: parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
      area: Math.round(rect.width * rect.height),
      thirdParty: isThirdParty(el),
    });
  }
  return out;
})()`;

async function auditRoute(page, route, theme) {
  // Set the preference BEFORE load, so the page boots in the theme rather than
  // being flipped afterwards — that is how a real visitor arrives.
  await page.evaluateOnNewDocument((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* private mode */
    }
  }, theme);

  await page.goto(`${BASE}${route}`, {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await new Promise((r) => setTimeout(r, 350));

  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  const nodes = await page.evaluate(COLLECT);
  const findings = [];

  for (const n of nodes) {
    if (n.hasText && !n.thirdParty) {
      const fg = parseRgb(n.color);
      const bg = parseRgb(n.effBg);
      if (fg && bg) {
        const large =
          n.fontSize >= 24 ||
          (n.fontSize >= 18.66 && Number(n.fontWeight) >= 700);
        const min = large ? AA_LARGE : AA_NORMAL;
        const r = ratio(fg, bg);
        if (r < min) {
          findings.push({
            kind: "contrast",
            route,
            theme,
            tag: n.tag,
            cls: n.cls,
            detail: `"${n.text}" ${r.toFixed(2)}:1 (needs ${min})`,
          });
        }
      }
    }

    // Mixed theming, on OPAQUE surfaces only.
    //
    // Translucency is what separates a themed surface from a wash. The auth
    // modal's scrim is `rgba(0,0,0,0.75)`, and reading it as a surface reported
    // it as "a dark surface in the light theme" on five routes — the first run
    // of this eval did exactly that. A scrim is meant to be dark on both
    // grounds, and the same goes for a frosted panel: what shows through is the
    // page beneath, which is itself themed.
    const own = parseRgb(n.bg);
    if (own && n.area > 2000 && alphaOf(n.bg) >= 0.95 && !n.thirdParty) {
      const lum = relativeLuminance(own);
      if (!isDark && lum < 0.04) {
        findings.push({
          kind: "mixed",
          route,
          theme,
          tag: n.tag,
          cls: n.cls,
          detail: `dark surface (luminance ${lum.toFixed(3)}) in the light theme`,
        });
      }
      if (isDark && lum > 0.8) {
        findings.push({
          kind: "mixed",
          route,
          theme,
          tag: n.tag,
          cls: n.cls,
          detail: `light surface (luminance ${lum.toFixed(3)}) in the dark theme`,
        });
      }
    }
  }
  return findings;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const all = [];
for (const route of ROUTES) {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    try {
      const findings = await auditRoute(page, route, theme);
      all.push(...findings);
      const c = findings.filter((f) => f.kind === "contrast").length;
      const m = findings.filter((f) => f.kind === "mixed").length;
      console.log(
        `${theme.padEnd(5)} ${route.padEnd(22)} contrast:${String(c).padStart(3)}  mixed:${String(m).padStart(3)}`,
      );
    } catch (err) {
      console.log(`${theme.padEnd(5)} ${route.padEnd(22)} ERROR ${err.message.slice(0, 60)}`);
      all.push({
        kind: "error",
        route,
        theme,
        tag: "-",
        cls: "-",
        detail: err.message.slice(0, 120),
      });
    }
    await page.close();
  }
}

await browser.close();

mkdirSync("/tmp/theme-eval", { recursive: true });
const byKind = (k) => all.filter((f) => f.kind === k);

// Group identical findings: one bad token shows up on every route that uses it,
// and a list of 300 rows hides the fact that it is really three problems.
const grouped = new Map();
for (const f of all) {
  const key = `${f.kind}|${f.theme}|${f.tag}|${f.cls}|${f.detail.replace(/"[^"]*"/, "")}`;
  if (!grouped.has(key)) grouped.set(key, { ...f, count: 0, routes: new Set() });
  const g = grouped.get(key);
  g.count += 1;
  g.routes.add(f.route);
}

const report = [
  "# Theme coverage eval",
  "",
  `${ROUTES.length} routes x 2 themes. ${all.length} finding(s), ${grouped.size} distinct.`,
  "",
  `- contrast: ${byKind("contrast").length}`,
  `- mixed:    ${byKind("mixed").length}`,
  `- errors:   ${byKind("error").length}`,
  "",
  "| kind | theme | n | routes | element | detail |",
  "| --- | --- | --- | --- | --- | --- |",
  ...[...grouped.values()]
    .sort((a, b) => b.count - a.count)
    .map(
      (g) =>
        `| ${g.kind} | ${g.theme} | ${g.count} | ${[...g.routes].slice(0, 3).join(", ")}${g.routes.size > 3 ? ` +${g.routes.size - 3}` : ""} | \`${g.tag}.${g.cls}\` | ${g.detail} |`,
    ),
].join("\n");
writeFileSync("/tmp/theme-eval/report.md", report + "\n");

console.log(
  `\n${all.length} finding(s), ${grouped.size} distinct -> /tmp/theme-eval/report.md`,
);
process.exitCode = all.length === 0 ? 0 : 1;

// Extending coverage: the authenticated routes render their signed-out state
// here. To reach the signed-in ones, seed the auth token into localStorage in the
// evaluateOnNewDocument call above, the same way the theme is seeded, using a
// test account from the backend fixtures.
