import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // required for GitHub Pages when the repo is not username.github.io
  base: '/kickout-app/',
});
