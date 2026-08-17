/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
// Explicit extension: Vite's native config loader cannot resolve an
// extensionless relative import, and warns that it will be the default.
import { SUPABASE_CACHE_NAME } from './src/lib/cache-names.ts';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // No `includeAssets`: everything in public/ is copied into dist/ by Vite
      // and already matched by `globPatterns` below. Listing them again
      // precaches each one twice — verified, it produced five duplicate
      // entries and ~21 kB of pointless download.

      manifest: {
        name: 'סונול — ניהול סבבי הפצה',
        short_name: 'סונול',
        description: 'ניהול סבבי הפצה לתחנות דלק',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // The app is a one-handed list on a phone in a vehicle. Landscape is
        // never the intended posture.
        orientation: 'portrait',
        // Both taken from the light token layer in globals.css, so the splash
        // screen matches the app instead of flashing white.
        theme_color: '#1E3A8A',
        background_color: '#F8FAFC',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Heebo ships five subsets in one stylesheet and there is no per-subset
        // entry point to import instead. `unicode-range` already stops the
        // browser fetching these two, but the precache would download them
        // anyway — ~38 kB a worker never renders a glyph from.
        globIgnores: [
          '**/heebo-math-*.woff2',
          '**/heebo-symbols-*.woff2',
          // The plugin already precaches the manifest's icons itself; matching
          // them here as well lists each one twice.
          '**/pwa-*.png',
        ],

        // A deep link must resolve to the shell; the app is a browser router.
        navigateFallback: 'index.html',

        runtimeCaching: [
          {
            /*
             * Supabase reads only, and only GET.
             *
             * NetworkFirst, not StaleWhileRevalidate: station data that is
             * five minutes stale is worth showing to someone in a dead spot,
             * but never in preference to the live answer. The five-second
             * timeout is what makes it useful on a weak signal rather than a
             * dead one — the tab does not hang waiting for a request that will
             * not complete.
             *
             * `/auth/v1/` is excluded by the matcher. Caching a token exchange
             * would be a straightforward way to serve one user another's
             * session.
             */
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/rest\/v1\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: SUPABASE_CACHE_NAME,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },

      devOptions: {
        // Off by default: a service worker in dev caches the very files being
        // edited. Opt in with `VITE_PWA_DEV=1` when working on the SW itself.
        enabled: process.env.VITE_PWA_DEV === '1',
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Vitest's default glob would collect `e2e/*.spec.ts` too, and those are
    // Playwright specs — they cannot run under Vitest and would break
    // `npm run verify` the moment they landed.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Phase-1 risk mitigation: src/lib/supabase.ts fails fast when the env vars
    // are absent. Without these, every test that transitively imports it would
    // explode with a config error instead of a real failure.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['src/types/**', 'src/test/**', '**/*.config.*'],
    },
  },
});
