import {
  TAILWIND_PALETTE,
  DARK_TOKENS,
  PARITY_MAP,
  PARITY_EXCEPTIONS,
} from "./tokens";

describe("dark mode parity", () => {
  it("maps every dark token that claims parity to a real palette entry", () => {
    for (const paletteName of Object.values(PARITY_MAP)) {
      expect(TAILWIND_PALETTE[paletteName]).toBeDefined();
    }
  });

  it.each(Object.entries(PARITY_MAP))(
    "dark token %s equals palette %s, so dark mode renders unchanged",
    (tokenName, paletteName) => {
      expect(DARK_TOKENS[tokenName]).toBe(TAILWIND_PALETTE[paletteName]);
    },
  );

  it("documents a reason for every parity exception", () => {
    for (const [token, meta] of Object.entries(PARITY_EXCEPTIONS)) {
      expect(DARK_TOKENS[token] ?? "").not.toBe("");
      expect(meta.reason).toMatch(/\S/);
      expect(meta.was).toMatch(/\S/);
    }
  });

  it("has no token both claiming parity and listed as an exception", () => {
    for (const token of Object.keys(PARITY_EXCEPTIONS)) {
      expect(PARITY_MAP[token]).toBeUndefined();
    }
  });
});
