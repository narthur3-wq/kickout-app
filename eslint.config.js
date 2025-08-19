// eslint.config.js (ESLint v9 flat config)
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

export default [
  // Ignore generated/build artifacts (and temporarily Pitch.svelte until we fix its syntax)
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "docs/**",
      "public/**",
      "**/*.min.js",
      "src/lib/Pitch.svelte" // TODO: remove once we fix parsing there
    ]
  },

  // Base JS + Svelte
  js.configs.recommended,
  ...svelte.configs["flat/recommended"],

  // App source: tell ESLint we're in the browser
  {
    files: ["**/*.{js,svelte}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser, // window, document, fetch, etc.
        ...globals.es2021,
        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        queueMicrotask: "readonly",
        Blob: "readonly",
        URL: "readonly",
        CustomEvent: "readonly",
        HTMLMediaElement: "readonly",
        EventTarget: "readonly"
      }
    },
    rules: {
      "no-console": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  },

  // Tests: enable Vitest globals for both `*.test.js` and files under __tests__
  {
    files: ["**/*.test.{js,ts}", "**/__tests__/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.vitest,
        // Belt & braces (sometimes useful with older `globals` versions):
        test: "readonly",
        expect: "readonly",
        describe: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly"
      }
    }
  }
];
