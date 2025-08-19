import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // IMPORTANT for GitHub Pages under /kickout-app/
  base: '/kickout-app/',
});
