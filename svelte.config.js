// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    compatibility: {
      componentApi: 4   // allow `new App({ target })` style
    }
  }
};
