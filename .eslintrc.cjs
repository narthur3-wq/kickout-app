module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:svelte/recommended",
  ],
  overrides: [
    {
      files: ["*.svelte"],
      processor: "svelte/svelte",
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["svelte"],
  rules: {
    // Example: allow console.log during dev, warn in prod
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
  },
};
