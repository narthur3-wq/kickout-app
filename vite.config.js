import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  // Relative URLs so it works on GitHub Pages subpaths, local file opens, etc.
  base: './',
})
