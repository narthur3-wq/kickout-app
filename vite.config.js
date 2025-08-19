import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

<<<<<<< HEAD
// Your repo is https://github.com/narthur3-wq/kickout-app
// so the base must be '/kickout-app/'
export default defineConfig({
  plugins: [svelte()],
  base: '/kickout-app/',
=======
export default defineConfig({
  plugins: [svelte()],
  base: '/kickout-app/'   // e.g. '/kickout-app/'  (use '/' only if the repo is USERNAME.github.io)
>>>>>>> 371f6a4 (Set Vite base to /kickout-app/ and publish build to docs)
})
