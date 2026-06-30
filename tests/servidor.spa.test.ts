import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { crearServidorLocal } from '../src/servidor/servidorLocal';
import type { ServidorLocal } from '../src/servidor/tipos';

// Prueba de integración (tarea 17.3): la SPA se entrega en español por HTTP.
//
// Validates: Requirements 1.3 — "WHEN un Cliente_Jugador en la misma red local
// accede a la dirección publicada, THE Servidor_Local SHALL entregar la
// interfaz web del juego en español."
//
// Arrancamos un Servidor_Local real apuntando `directorioEstaticos` a la
// carpeta `src/cliente`, que contiene un index.html con `lang="es"` y texto en
// español. Esto evita depender de que exista el build (`dist/cliente`) en CI.
// Hacemos una petición HTTP real (fetch global de Node 18+/20) a la raíz y
// verificamos el código de estado, el content-type y el contenido en español.

const DIRECTORIO_CLIENTE = resolve(__dirname, '..', 'src', 'cliente');
const TIMEOUT_MS = 10_000;

describe('Servidor_Local entrega la SPA en español por HTTP', () => {
  let servidor: ServidorLocal | null = null;

  afterEach(async () => {
    if (servidor) {
      await servidor.detener();
      servidor = null;
    }
  });

  it(
    'responde 200 con HTML en español en la ruta raíz',
    async () => {
      servidor = crearServidorLocal({ directorioEstaticos: DIRECTORIO_CLIENTE });

      // Puerto 0: el sistema asigna un puerto efímero libre.
      const direccion = await servidor.iniciar(0);

      // Para máxima robustez en CI usamos loopback con el puerto real asignado;
      // el servidor escucha en todas las interfaces, así que la raíz es la SPA.
      const url = `http://127.0.0.1:${direccion.puerto}/`;
      const respuesta = await fetch(url);

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get('content-type')).toMatch(/text\/html/i);

      const cuerpo = await respuesta.text();
      // Interfaz en español: atributo de idioma y contenido temático en español.
      expect(cuerpo).toContain('lang="es"');
      expect(cuerpo).toContain('The Gang');
      expect(cuerpo).toContain('golpe');
    },
    TIMEOUT_MS,
  );
});
