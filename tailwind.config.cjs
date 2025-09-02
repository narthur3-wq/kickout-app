/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{svelte,js,ts}"],
  corePlugins: { preflight: false }, // keeps your pitch/buttons untouched
  theme: { extend: {} },
  plugins: [],
};
