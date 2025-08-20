import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/postcss'; // Tailwind v4

export default defineConfig({
  plugins: [svelte()],
  css: {
    // This bypasses postcss-load-config completely and always gives an ARRAY
    postcss: {
      plugins: [tailwindcss],
    },
  },
});
