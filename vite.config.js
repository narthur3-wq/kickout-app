import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      useCredentials: true,
      includeAssets: ['favicon.svg', 'icon.svg', 'crest.png'],
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'P\u00E1irc \u2014 GAA Match Analyst',
        short_name: 'P\u00E1irc',
        description: 'Live GAA match event capture and analytics',
        start_url: './',
        display: 'standalone',
        background_color: '#f4f7f4',
        theme_color: '#0a5500',
        orientation: 'portrait-primary',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  base: '/',
})
