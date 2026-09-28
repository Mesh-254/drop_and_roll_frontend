import { useMemo } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { getStripeCardStyle } from "./stripeCardStyle";

export default function useStripeCardStyle(fontSize) {
  const { isDark } = useTheme();
  return useMemo(() => getStripeCardStyle(isDark, fontSize), [isDark, fontSize]);
}
