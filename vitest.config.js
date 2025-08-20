import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  plugins: [svelte()],
  css: {
    // This bypasses postcss-load-config and always supplies an array
    postcss: {
      plugins: [tailwindcss],
    },
  },
});
