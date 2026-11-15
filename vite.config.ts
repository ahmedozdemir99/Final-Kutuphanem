import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: [
          'favicon.ico',
          'favicon.png',
          'apple-touch-icon.png',
          'icon-192.png',
          'icon-512.png',
          'pwa-maskable-192x192.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Dijital Kütüphanem',
          short_name: 'Kütüphanem',
          description: 'Premium Personal Library & Lifelong Learning System',
          theme_color: '#440405',
          background_color: '#F8F5EF',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: "Canlı Masaüstü Widget'ı",
              short_name: 'Widget',
              description: 'Günün Vecizesi & Canlı Okuma Takip Widgetı',
              url: '/?widget=true',
              icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Günün Vecizesi & Hikmeti',
              short_name: 'Günün Vecizesi',
              description: 'Günün vecizesi ve hikmetli sözü',
              url: '/?tab=today&action=wisdom',
              icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: "Kur'an-ı Kerim",
              short_name: "Kur'an-ı Kerim",
              description: "Kur'an-ı Kerim okuma ve dinleme",
              url: '/?tab=explore&sub=quran',
              icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
          widgets: [
            {
              name: 'Dijital Kütüphanem Canlı Widget',
              short_name: 'Kütüphanem Widget',
              description: 'Günün Vecizesi & Günlük Okuma Takibi',
              tag: 'reading-widget',
              template: 'reading-widget',
              data: '/?widget=true',
              type: 'text/html',
              icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
        } as any,
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
          importScripts: ['/notifications-sw.js'],
          globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'classic',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      allowedHosts: true as const,
      hmr: false,
      watch: null,
    },
  };
});
