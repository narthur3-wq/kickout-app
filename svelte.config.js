import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Disable style postcss discovery; Vite handles global CSS
  preprocess: vitePreprocess({ style: false }),
};
