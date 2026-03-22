import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Páirc — GAA Match Analyst',
        short_name: 'Páirc',
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
        // Cache the app shell + all static assets
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Don't precache Supabase or external URLs
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  base: '/',
})
