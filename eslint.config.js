import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: { react },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      // An identifier used ONLY inside JSX is used. Without this rule, core
      // eslint cannot see `<Icon />` as a reference to `Icon`, so the standard
      // React idiom of passing a component as a prop —
      // `function Fact({ icon: Icon })`, then `<Icon />` — was reported as an
      // unused variable. `varsIgnorePattern: "^[A-Z_]"` above hid it for plain
      // variables but not for destructured parameters, which is why
      // BulkUploadDetail.jsx:884 has been erroring on exactly this.
      //
      // eslint-plugin-react is already a devDependency; it was just never wired
      // into the flat config. This enables the one rule that fixes the false
      // positive, rather than loosening no-unused-vars to hide it.
      "react/jsx-uses-vars": "error",
    },
  },
  {
    // Jest test files: register the jest globals (describe/it/expect/jest/...)
    // so tests don't need per-file /* eslint-env jest */ comments, which flat
    // config no longer recognizes.
    files: ["**/*.test.{js,jsx}", "jest.setup.js"],
    languageOptions: {
      // commonjs adds `require` for jest.mock factories in otherwise-ESM tests
      globals: { ...globals.browser, ...globals.jest, ...globals.commonjs },
    },
  },
]);
