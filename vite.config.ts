import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['lagan-icon-192.png', 'lagan-icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'LAGAN — Build Your Character',
        short_name: 'LAGAN',
        description: 'LAGAN turns daily habits into character progress.',
        theme_color: '#08090a',
        background_color: '#060708',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'lagan-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'lagan-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'lagan-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
})
