import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Cross-origin isolation (03 §12): lets background removal's CPU fallback use several threads.
// credentialless keeps Cloudinary images, fonts and the model files loading without changes; browsers
// that don't support it simply aren't isolated. Production hosting must send the same two headers.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run phone` builds with this mode: the app calls the API on its own address (/api, forwarded below),
  // so a phone reaching the laptop through one HTTPS tunnel address gets both the app and the API.
  if (mode === 'phone') process.env.VITE_API_URL = '/api/v1';

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Installable only (03 §10): app shell, fonts and the background-removal files are cached;
      // API answers and Cloudinary images never are.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon.svg'],
        manifest: {
          name: 'Drape',
          short_name: 'Drape',
          display: 'standalone',
          start_url: '/',
          background_color: '#FFFFFF',
          theme_color: '#6A4566',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            // Background-removal model + WASM (version-pinned paths on img.ly's CDN): download once per device.
            {
              urlPattern: ({ url }) => url.origin === 'https://staticimgly.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'background-removal',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-css' },
            },
            {
              urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Fixed port so it always matches the server's CLIENT_URL (CORS).
      port: 5173,
      strictPort: true,
      proxy: { '/api': 'http://localhost:4000' },
      allowedHosts: ['.trycloudflare.com'],
      headers: isolation,
    },
    preview: {
      port: 4173,
      strictPort: true,
      headers: isolation,
    },
  };
});
