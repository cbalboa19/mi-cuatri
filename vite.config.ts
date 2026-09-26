import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Los tests de fechas asumen la zona horaria de Madrid (cambios de hora incluidos),
// también en CI, donde la máquina está en UTC.
process.env.TZ = 'Europe/Madrid';

// BASE_PATH lo fija el workflow de despliegue (p. ej. "/mi-cuatri/" en GitHub Pages).
const base = process.env.BASE_PATH ?? '/';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: {
        name: 'Mi cuatri',
        short_name: 'Mi cuatri',
        description: 'Horario, gym, progreso y checklists del cuatrimestre.',
        lang: 'es',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ECEFF3',
        theme_color: '#ECEFF3',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
