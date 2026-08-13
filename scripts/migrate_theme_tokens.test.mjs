import { migrateClassString, migrateSource } from "./migrate_theme_tokens.mjs";

describe("migrateClassString", () => {
  it("maps a dark card surface to the card token", () => {
    expect(migrateClassString("bg-gray-900 rounded-lg").value).toBe(
      "bg-card rounded-lg",
    );
  });

  it("maps body text", () => {
    expect(migrateClassString("text-white font-bold").value).toBe(
      "text-foreground font-bold",
    );
  });

  it("maps secondary text from both grey families to one token", () => {
    expect(migrateClassString("text-gray-400").value).toBe("text-muted-foreground");
    expect(migrateClassString("text-slate-400").value).toBe(
      "text-muted-foreground",
    );
  });

  it("preserves variant prefixes", () => {
    expect(
      migrateClassString("hover:bg-gray-800 focus:border-gray-700").value,
    ).toBe("hover:bg-surface focus:border-border");
  });

  it("preserves opacity modifiers", () => {
    expect(migrateClassString("border-orange-500/30").value).toBe(
      "border-primary/30",
    );
  });

  it("preserves a variant AND an opacity modifier together", () => {
    expect(migrateClassString("hover:bg-orange-500/20").value).toBe(
      "hover:bg-primary/20",
    );
  });

  // THE ON-COLOUR RULE. 61 elements put text-white on a coloured background.
  // Mapping those to text-foreground makes every primary button label wrong.
  it("keeps white readable on a brand background", () => {
    expect(migrateClassString("bg-orange-500 text-white").value).toBe(
      "bg-primary text-primary-foreground",
    );
  });

  it("applies the on-colour rule with the background written after the text", () => {
    expect(migrateClassString("text-white bg-orange-500").value).toBe(
      "text-primary-foreground bg-primary",
    );
  });

  it("applies the on-colour rule for a gradient background", () => {
    expect(
      migrateClassString(
        "bg-gradient-to-r from-orange-500 to-orange-600 text-white",
      ).value,
    ).toBe("bg-gradient-to-r from-primary to-primary-hover text-primary-foreground");
  });

  it("applies the on-colour rule for a state background", () => {
    expect(migrateClassString("bg-red-600 text-white").value).toBe(
      "bg-destructive text-destructive-foreground",
    );
  });

  it("does not treat a mere border as a coloured background", () => {
    expect(migrateClassString("border-orange-500 text-white").value).toBe(
      "border-primary text-foreground",
    );
  });

  it("leaves allow-listed brand colours alone", () => {
    expect(migrateClassString("bg-[#0070ba] text-white").value).toBe(
      "bg-[#0070ba] text-white",
    );
  });

  // REGRESSION. The on-colour regex only recognised palette backgrounds, so the
  // label beside an arbitrary-value brand background was treated as body text
  // and became text-foreground — dark text on PayPal blue in light mode.
  // text-primary-foreground would be just as wrong; it is also near-black. A
  // background outside the theme means the label stays literal.
  it("leaves a label on an arbitrary-value brand background literal", () => {
    const result = migrateClassString(
      "flex items-center bg-[#0070ba] hover:bg-[#005ea6] text-white rounded",
    );
    expect(result.value).toContain("text-white");
    expect(result.value).not.toContain("text-foreground");
    expect(result.value).not.toContain("text-primary-foreground");
  });

  it("leaves non-colour utilities untouched", () => {
    const input =
      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold";
    expect(migrateClassString(input).value).toBe(input);
  });

  it("does not mistake a fraction like w-1/2 for an opacity modifier", () => {
    expect(migrateClassString("w-1/2 bg-gray-900").value).toBe("w-1/2 bg-card");
  });

  // Translucent neutrals are scrims, dividers and glass bars, not surfaces.
  // bg-white/20 on a dark header is a light hairline; mapping it to bg-card/20
  // would make it a DARK hairline. Ambiguous by nature, so it is reported.
  it("refuses to guess at a translucent neutral background", () => {
    const result = migrateClassString("w-px h-6 bg-white/20");
    expect(result.value).toBe("w-px h-6 bg-white/20");
    expect(result.unmapped).toContain("bg-white/20");
  });

  // A full-bleed translucent black IS readable: it is always a modal scrim.
  // --overlay already encodes the translucency, so the modifier is dropped
  // rather than compounded.
  it("maps a full-bleed translucent black to the overlay token", () => {
    expect(migrateClassString("fixed inset-0 bg-black/50").value).toBe(
      "fixed inset-0 bg-overlay",
    );
    expect(migrateClassString("fixed inset-0 z-50 bg-black/60").value).toBe(
      "fixed inset-0 z-50 bg-overlay",
    );
  });

  it("still refuses to guess at a translucent black that is not full-bleed", () => {
    // The mobile menu's glass bar, not a scrim.
    const result = migrateClassString("md:hidden bg-black/95 backdrop-blur-md");
    expect(result.value).toContain("bg-black/95");
    expect(result.unmapped).toContain("bg-black/95");
  });

  it("does not compound opacity onto an already-translucent token", () => {
    // --*-surface is a 15% mix in dark; bg-success-surface/20 would fade it away.
    expect(migrateClassString("dark:bg-green-900/20").value).toBe(
      "dark:bg-success-surface",
    );
  });

  it("collapses a state pair once the dark half drops its opacity", () => {
    expect(migrateClassString("bg-green-50 dark:bg-green-900/20").value).toBe(
      "bg-success-surface",
    );
  });

  it("maps subtle state borders to a tinted border, collapsing the pair", () => {
    expect(migrateClassString("border-red-200 dark:border-red-800").value).toBe(
      "border-destructive/30",
    );
  });

  it("still maps an opaque neutral background", () => {
    expect(migrateClassString("bg-black").value).toBe("bg-background");
  });

  it("maps faded body text, where the role is unchanged", () => {
    expect(migrateClassString("text-white/90").value).toBe("text-foreground/90");
  });

  it("reports classes it cannot map instead of guessing", () => {
    const result = migrateClassString("bg-fuchsia-700");
    expect(result.value).toBe("bg-fuchsia-700");
    expect(result.unmapped).toContain("bg-fuchsia-700");
  });

  it("is idempotent", () => {
    const once = migrateClassString("bg-gray-900 text-white").value;
    expect(migrateClassString(once).value).toBe(once);
  });

  // A hand-written light/dark pair collapses to ONE token, because the token
  // already knows what to be in each theme.
  it("collapses a dark: variant that duplicates its own token", () => {
    expect(migrateClassString("bg-red-50 dark:bg-red-900").value).toBe(
      "bg-destructive-surface",
    );
  });

  it("collapses a duplicated text pair", () => {
    expect(migrateClassString("text-gray-900 dark:text-white").value).toBe(
      "text-foreground",
    );
  });

  it("keeps a dark: variant that means a genuinely different role", () => {
    // gray-900 -> card and gray-800 -> surface are different tokens, so the
    // author wanted different roles per theme. That must survive review.
    expect(migrateClassString("bg-gray-900 dark:bg-gray-800").value).toBe(
      "bg-card dark:bg-surface",
    );
  });

  it("leaves spacing sane after collapsing", () => {
    expect(
      migrateClassString("rounded bg-red-50 dark:bg-red-900 p-2").value,
    ).toBe("rounded bg-destructive-surface p-2");
  });

  it("preserves whitespace shape, so diffs stay readable", () => {
    expect(migrateClassString("bg-gray-900   text-white").value).toBe(
      "bg-card   text-foreground",
    );
  });
});

describe("migrateSource", () => {
  it("rewrites a className string literal", () => {
    const src = `export const A = () => <div className="bg-gray-900 text-white">hi</div>;`;
    expect(migrateSource(src).source).toContain(
      'className="bg-card text-foreground"',
    );
  });

  it("rewrites inside a template literal, leaving expressions alone", () => {
    const src =
      "const c = `bg-gray-900 ${isActive ? 'text-white' : 'text-gray-400'}`;";
    const out = migrateSource(src).source;
    expect(out).toContain("bg-card");
    expect(out).toContain("text-foreground");
    expect(out).toContain("text-muted-foreground");
    expect(out).toContain("${isActive ?");
  });

  // The on-colour decision has to see the WHOLE class list. A ternary branch
  // holding only 'text-white' looks like body text in isolation, but the
  // background it sits on is in the surrounding literal.
  it("applies the on-colour rule across a template literal boundary", () => {
    const src = "const c = `bg-orange-500 ${big ? 'text-white' : 'text-sm'}`;";
    expect(migrateSource(src).source).toContain("text-primary-foreground");
  });

  it("does not touch string literals that are not class lists", () => {
    const src = `const msg = "the text-white paint is bg-gray-900 in colour";`;
    expect(migrateSource(src).source).toBe(src);
  });

  it("counts what it changed", () => {
    const src = `<div className="bg-gray-900 text-white" />`;
    expect(migrateSource(src).changed).toBe(2);
  });

  it("is idempotent over a whole file", () => {
    const src = `<div className="bg-gray-900 text-white hover:bg-gray-800" />`;
    const once = migrateSource(src).source;
    expect(migrateSource(once).source).toBe(once);
    expect(migrateSource(once).changed).toBe(0);
  });
});
