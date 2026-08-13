/**
 * Colour maths for the theme contrast tests.
 *
 * WHY THIS IS ITS OWN MODULE. Accessibility here is arithmetic, not judgement:
 * either a token pair clears 4.5:1 or it does not. Keeping the maths pure and
 * separately tested means the theme tests measure the palette rather than
 * measuring this file's bugs.
 *
 * THE ONE TRAP. The OKLab -> RGB matrix below outputs LINEAR-LIGHT RGB. WCAG
 * relative luminance is also defined on linear values, so it consumes that
 * output directly. Applying the sRGB gamma decode (the `((c+0.055)/1.055)^2.4`
 * step) to it double-decodes and inflates every ratio — and it does so
 * invisibly, because 0 and 1 are fixed points of the gamma curve, so
 * white-on-black still comes out at exactly 21.00. Mid greys are what expose
 * it. See the regression test.
 */

const OKLCH_RE = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i;

/** Parse an `oklch(L C H)` string. Lightness is normalised to 0-1. */
export function parseOklch(str) {
  const match = OKLCH_RE.exec(String(str).trim());
  if (!match) throw new Error(`Not an oklch colour: ${str}`);
  const [, lRaw, isPercent, c, h] = match;
  const l = isPercent ? Number(lRaw) / 100 : Number(lRaw);
  return { l, c: Number(c), h: Number(h) };
}

/** oklch -> linear-light sRGB, clamped to gamut. */
export function oklchToLinearSrgb({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lLong = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const lMed = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const lShort = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * lLong - 3.3077115913 * lMed + 0.2309699292 * lShort,
    -1.2684380046 * lLong + 2.6097574011 * lMed - 0.3413193965 * lShort,
    -0.0041960863 * lLong - 0.7034186147 * lMed + 1.707614701 * lShort,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

/** WCAG relative luminance. Input MUST already be linear (see module note). */
export function relativeLuminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toLinear(color) {
  return Array.isArray(color) ? color : oklchToLinearSrgb(parseOklch(color));
}

/** WCAG 2.1 contrast ratio, 1..21. Accepts oklch strings or linear triples. */
export function contrastRatio(colorA, colorB) {
  const a = relativeLuminance(toLinear(colorA));
  const b = relativeLuminance(toLinear(colorB));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
