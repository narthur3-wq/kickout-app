import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.js", "**/*.svelte"],
    languageOptions: {
      globals: { window: "readonly", document: "readonly" },
    },
  },
  prettier,
];
