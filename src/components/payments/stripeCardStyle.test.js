import { getStripeCardStyle } from "./stripeCardStyle";

describe("Stripe card field styles", () => {
  test.each([
    ["light", false, "#1f2937", "#6b7280", "#b91c1c"],
    ["dark", true, "#f1f5f9", "#94a3b8", "#f87171"],
  ])("%s mode keeps entered, placeholder, and invalid text readable", (
    _theme,
    isDark,
    textColor,
    placeholderColor,
    invalidColor,
  ) => {
    const { style } = getStripeCardStyle(isDark);
    expect(style.base.color).toBe(textColor);
    expect(style.base["::placeholder"].color).toBe(placeholderColor);
    expect(style.base[":focus"].color).toBe(textColor);
    expect(style.base[":hover"].color).toBe(textColor);
    expect(style.base.iconColor).toBe(placeholderColor);
    expect(style.invalid.color).toBe(invalidColor);
    expect(style.invalid["::placeholder"].color).toBe(invalidColor);
    expect(style.base.fontSize).toBe("16px");
  });

  test("allows an existing form font size to be preserved", () => {
    expect(getStripeCardStyle(false, "15px").style.base.fontSize).toBe("15px");
  });
});
