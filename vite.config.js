// vite.config.js
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// If deploying to GitHub Pages at https://USERNAME.github.io/kickout-app/
// keep base set to '/kickout-app/'. If you deploy at the domain root, change to '/'.
export default defineConfig({
  plugins: [svelte()],
  base: '/kickout-app/',
})
