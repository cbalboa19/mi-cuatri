import { readFileSync } from 'node:fs';
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
