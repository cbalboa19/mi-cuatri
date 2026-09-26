import { defineConfig } from 'vitest/config';

// BASE_PATH lo fija el workflow de despliegue (p. ej. "/mi-cuatri/" en GitHub Pages).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
