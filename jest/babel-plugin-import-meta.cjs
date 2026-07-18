// Jest-only Babel plugin: rewrite `import.meta` to a plain object so modules
// that read Vite's `import.meta.env` (e.g. src/api/ApiBase.js) transform cleanly
// under Babel's CommonJS output. Env values are undefined in tests — mock them
// per-test where a specific value is needed. Kept as a file (not an inline
// function in jest.config) so babel-jest can compute a stable transform cache key.
module.exports = function importMetaToObject() {
  return {
    name: "import-meta-to-object",
    visitor: {
      MetaProperty(path) {
        path.replaceWithSourceString("({ env: {} })");
      },
    },
  };
};
