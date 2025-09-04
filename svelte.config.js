/** @type {import('svelte').Config} */
const dev = process.env.NODE_ENV !== 'production';

const config = {
  compilerOptions: {
    dev,
    // allow `new App({ target })` on Svelte 5
    compatibility: { componentApi: 4 }
  }
};

export default config;
