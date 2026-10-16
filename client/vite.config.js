import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const proxy = { '/api': 'http://localhost:5000' };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + offline app shell. Attendance data itself lives in IndexedDB (src/offline).
    VitePWA({
      registerType: 'autoUpdate',
      // Own service worker (src/sw.js) so notifications can carry reply buttons.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], maximumFileSizeToCacheInBytes: 3 * 1024 * 1024 },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Haajari — School attendance',
        short_name: 'Haajari',
        description: 'One-tap school attendance that works offline',
        lang: 'kn',
        theme_color: '#1E4A3B',
        background_color: '#EEF2EF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5180, strictPort: true, host: true, proxy },
  preview: { port: 4173, strictPort: true, host: true, proxy },
});
