import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Configuración de Vite para el Cliente_Jugador (SPA en español).
// El cliente vive en src/cliente; el build se emite a dist/cliente para
// que el Servidor_Local lo sirva como estáticos.
export default defineConfig({
  root: resolve(__dirname, 'src/cliente'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/cliente'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
