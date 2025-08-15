// vite.config.js
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// If your repo is https://github.com/USERNAME/kickout-app,
// set base to '/kickout-app/'. If your repo is USERNAME.github.io, use '/'.
export default defineConfig({
  plugins: [svelte()],
  base: '/REPO_NAME/'   // e.g. '/kickout-app/'  or '/' for USERNAME.github.io
})
