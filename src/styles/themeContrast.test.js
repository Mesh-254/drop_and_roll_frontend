import { contrastRatio } from "./colorMath";
import { LIGHT_TOKENS, DARK_TOKENS, CONTRAST_PAIRS } from "./tokens";

describe.each([
  ["light", LIGHT_TOKENS],
  ["dark", DARK_TOKENS],
])("%s theme contrast", (themeName, tokens) => {
  it.each(CONTRAST_PAIRS)(
    "$label ($fg on $bg) clears $min:1",
    ({ fg, bg, min, label }) => {
      expect(tokens[fg]).toBeDefined();
      expect(tokens[bg]).toBeDefined();
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      // Surface the number in the failure, so it is actionable without a rerun.
      if (ratio < min) {
        throw new Error(
          `${themeName}: ${label} (${fg} on ${bg}) = ${ratio.toFixed(2)}:1, needs ${min}:1`,
        );
      }
      expect(ratio).toBeGreaterThanOrEqual(min);
    },
  );

  it("defines exactly the same token names as the other theme", () => {
    const other = tokens === LIGHT_TOKENS ? DARK_TOKENS : LIGHT_TOKENS;
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(other).sort());
  });
});
