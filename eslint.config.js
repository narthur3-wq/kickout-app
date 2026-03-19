import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.svelte", "**/*.js"],
    plugins: { svelte },
    languageOptions: {
      globals: { window: "readonly", document: "readonly" },
    },
    rules: {
      ...svelte.configs["flat/recommended"].rules,
    },
  },
  prettier,
];
