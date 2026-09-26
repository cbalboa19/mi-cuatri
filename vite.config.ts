import { defineConfig } from 'vitest/config';

// Los tests de fechas asumen la zona horaria de Madrid (cambios de hora incluidos),
// también en CI, donde la máquina está en UTC.
process.env.TZ = 'Europe/Madrid';

// BASE_PATH lo fija el workflow de despliegue (p. ej. "/mi-cuatri/" en GitHub Pages).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
