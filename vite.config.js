import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Your repo is https://github.com/narthur3-wq/kickout-app
// so the base must be '/kickout-app/'
export default defineConfig({
  plugins: [svelte()],
  base: '/kickout-app/', // important for GitHub Pages
})
