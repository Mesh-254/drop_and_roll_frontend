const SPECIAL_RE = /[!@#$%^&*()\-_=+[\]{}|;:,.<>?]/;

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: "number",
    label: "At least one number",
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "At least one special character (!@#$%^&*()-_=+[]{}|;:,.<>?)",
    test: (p) => SPECIAL_RE.test(p),
  },
];

/** Returns the list of unmet rules for a given password string. */
export function getFailedRules(password) {
  return PASSWORD_RULES.filter((rule) => !rule.test(password));
}

/** Returns 'none' | 'weak' | 'medium' | 'strong'. */
export function getPasswordStrength(password) {
  if (!password) return "none";
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  if (passed <= 2) return "weak";
  if (passed <= 4) return "medium";
  return "strong";
}
