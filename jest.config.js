import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "\\.(css|scss)$": "identity-obj-proxy",
  },
  // Transform ESM + JSX for Jest ONLY. `configFile:false`/`babelrc:false` keeps
  // this fully isolated from Vite's own React/Babel pipeline, so adding test
  // tooling can never change the production build.
  transform: {
    "^.+\\.(js|jsx|mjs)$": [
      "babel-jest",
      {
        configFile: false,
        babelrc: false,
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          ["@babel/preset-react", { runtime: "automatic" }],
        ],
        // Vite exposes config via `import.meta.env`, which Babel's CommonJS
        // transform can't emit. This plugin rewrites `import.meta` to a plain
        // object so modules that read Vite env (e.g. ApiBase) import cleanly in
        // Jest. Absolute path + file (not inline) so babel-jest can cache-key it.
        plugins: [path.join(dir, "jest/babel-plugin-import-meta.cjs")],
      },
    ],
  },
};
