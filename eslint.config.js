import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
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
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
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
