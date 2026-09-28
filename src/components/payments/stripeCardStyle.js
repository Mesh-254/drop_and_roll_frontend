export function getStripeCardStyle(isDark, fontSize = "16px") {
  const colors = isDark
    ? {
        text: "#f1f5f9",
        placeholder: "#94a3b8",
        invalid: "#f87171",
      }
    : {
        text: "#1f2937",
        placeholder: "#6b7280",
        invalid: "#b91c1c",
      };

  return {
    style: {
      base: {
        color: colors.text,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize,
        "::placeholder": { color: colors.placeholder },
        ":focus": { color: colors.text },
        ":hover": { color: colors.text },
        iconColor: colors.placeholder,
      },
      invalid: {
        color: colors.invalid,
        "::placeholder": { color: colors.invalid },
      },
    },
  };
}
