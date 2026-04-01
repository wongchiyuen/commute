import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));


export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '生活日常',
        short_name: '生活日常',
        description: '香港交通、天氣、新聞一手掌握',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#06080d',
        theme_color: '#06080d',
        lang: 'zh-Hant',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
        categories: ['utilities', 'travel', 'weather'],
        shortcuts: [
          { name: '附近交通', url: '/', description: '查看附近巴士及港鐵班次' },
          { name: '交通消息', url: '/?tab=traffic', description: '最新特別交通消息' },
        ],
      },
      workbox: {
        // App shell — cache first
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache ETA or proxy calls
        navigateFallback: null,
        runtimeCaching: [
          // KMB static (routes / stops) — SWR 24hr
          {
            urlPattern: ({ url }) =>
              url.hostname === 'data.etabus.gov.hk' && /\/(route|stop)\/?$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kmb-static',
              expiration: { maxAgeSeconds: 86400 },
            },
          },
          // Weather current — SWR 5min
          {
            urlPattern: ({ url }) =>
              url.hostname === 'data.weather.gov.hk' && /rhrread|flw|fnd|warnsum/.test(url.search),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'weather-live',
              expiration: { maxAgeSeconds: 300 },
            },
          },
          // Weather tide / sunrise — SWR 24hr
          {
            urlPattern: ({ url }) =>
              url.hostname === 'data.weather.gov.hk' && /HLT|SRS|CLMM|RYES/.test(url.search),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'weather-static',
              expiration: { maxAgeSeconds: 86400 },
            },
          },
          // Traffic news XML — Network first, 2min fallback
          {
            urlPattern: ({ url }) => /td\.gov\.hk|data\.one\.gov\.hk.*td/.test(url.href),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'traffic',
              expiration: { maxAgeSeconds: 120 },
              networkTimeoutSeconds: 6,
            },
          },
          // CF Proxy (RSS) — Network only (bypass SW entirely)
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/proxy'),
            handler: 'NetworkOnly',
          },
          // ETA — Network only
          {
            urlPattern: ({ url }) =>
              /\/(stop-)?eta\/|getSchedule|lrt\/getSchedule/.test(url.pathname + url.search),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
