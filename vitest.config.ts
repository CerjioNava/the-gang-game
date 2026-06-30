import { defineConfig } from 'vitest/config';

// Configuración de Vitest para pruebas unitarias y basadas en propiedades (PBT).
// Las PBT usan fast-check con un mínimo de 100 iteraciones (ver tests/pbt.ts).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.ts',
    ],
  },
});
