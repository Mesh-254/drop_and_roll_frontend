import {
  parseOklch,
  oklchToLinearSrgb,
  relativeLuminance,
  contrastRatio,
} from "./colorMath";

describe("parseOklch", () => {
  it("parses percentage lightness into a 0-1 fraction", () => {
    expect(parseOklch("oklch(70.5% 0.213 47.604)")).toEqual({
      l: 0.705,
      c: 0.213,
      h: 47.604,
    });
  });

  it("parses a bare fractional lightness", () => {
    expect(parseOklch("oklch(0.21 0.034 264.665)")).toEqual({
      l: 0.21,
      c: 0.034,
      h: 264.665,
    });
  });

  it("throws on anything that is not an oklch colour", () => {
    expect(() => parseOklch("#ffffff")).toThrow(/oklch/i);
  });
});

describe("contrastRatio", () => {
  it("returns 21:1 for white on black", () => {
    expect(contrastRatio("oklch(100% 0 0)", "oklch(0% 0 0)")).toBeCloseTo(21, 1);
  });

  // REGRESSION. An implementation that applies the sRGB gamma decode to the
  // already-linear matrix output still returns 21.00 here, because 0 and 1 are
  // fixed points of the curve. A mid grey is what exposes it: gray-500 on white
  // is 4.84, and the double-decoding version reported 14.18.
  it("returns 4.84 for gray-500 on white, not 14.18", () => {
    const gray500 = "oklch(55.1% 0.027 264.364)";
    const white = "oklch(100% 0 0)";
    expect(contrastRatio(gray500, white)).toBeCloseTo(4.84, 1);
  });

  it("keeps a mid grey low against white", () => {
    // gray-400. Any result above ~3 means luminance is being computed wrong.
    expect(contrastRatio("oklch(70.7% 0.022 261.325)", "oklch(100% 0 0)")).toBeCloseTo(
      2.6,
      1,
    );
  });

  it("is symmetric", () => {
    const a = "oklch(21% 0.034 264.665)";
    const b = "oklch(98.5% 0.002 247.839)";
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });

  it("scores the approved primary button pair at 6.14", () => {
    const gray900 = "oklch(21% 0.034 264.665)";
    const orange500 = "oklch(70.5% 0.213 47.604)";
    expect(contrastRatio(gray900, orange500)).toBeCloseTo(6.14, 1);
  });
});

describe("oklchToLinearSrgb", () => {
  it("clamps out-of-gamut channels into 0-1", () => {
    const rgb = oklchToLinearSrgb(parseOklch("oklch(70% 0.4 30)"));
    for (const channel of rgb) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it("returns linear values, so relativeLuminance of white is 1", () => {
    expect(
      relativeLuminance(oklchToLinearSrgb(parseOklch("oklch(100% 0 0)"))),
    ).toBeCloseTo(1, 3);
  });
});
