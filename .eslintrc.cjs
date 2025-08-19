module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: ["eslint:recommended", "plugin:svelte/recommended"],
  overrides: [{ files: ["*.svelte"], processor: "svelte/svelte" }],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["svelte"],
  rules: {
    "no-console": "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
  }
};
