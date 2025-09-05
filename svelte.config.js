/** @type {import('svelte').Config} */
const dev = process.env.NODE_ENV !== 'production';

const config = {
  compilerOptions: {
    dev
  }
};

export default config;
