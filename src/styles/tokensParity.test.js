/* global __dirname */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIGHT_TOKENS, DARK_TOKENS } from "./tokens";

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

/** Pull `--name: value;` declarations out of the first block matching `selector`. */
function declarationsIn(selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`No ${selector} block in tokens.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open + 1, close);
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

describe("tokens.css matches tokens.js", () => {
  it.each([
    [":root", LIGHT_TOKENS],
    [".dark", DARK_TOKENS],
  ])("%s declares every token with the same value", (selector, expected) => {
    const actual = declarationsIn(selector);
    for (const [name, value] of Object.entries(expected)) {
      expect(actual[name]).toBe(value);
    }
  });

  it("declares no token in CSS that tokens.js does not know about", () => {
    const actual = declarationsIn(":root");
    for (const name of Object.keys(actual)) {
      expect(LIGHT_TOKENS[name]).toBeDefined();
    }
  });

  it("exposes every token to Tailwind via @theme inline", () => {
    for (const name of Object.keys(LIGHT_TOKENS)) {
      expect(css).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
