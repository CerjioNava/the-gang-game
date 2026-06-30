import { describe, it, expect, afterEach } from 'vitest';
import { crearServidorLocal } from '../src/servidor/servidorLocal';
import type { ServidorLocal, DireccionAcceso } from '../src/servidor/tipos';

// Prueba smoke del arranque del Servidor_Local (tarea 17.2).
//
// Verifica los criterios de infraestructura 1.1 y 1.2:
//   - El Servidor_Local arranca y comienza a escuchar conexiones dentro del
//     límite de tiempo (no mayor de 10 s).
//   - Publica una DireccionAcceso con la URL LAN a la que conectarse.
//
// Se usa el puerto 0 para que el sistema operativo asigne un puerto libre y
// evitar conflictos de puertos en CI/local. El servidor se cierra siempre en
// afterEach para no dejar el puerto abierto.

// Plazo del criterio 1.1: el arranque debe completarse en <= 10 s.
const LIMITE_ARRANQUE_MS = 10_000;

describe('Servidor_Local: smoke de arranque', () => {
  let servidor: ServidorLocal | null = null;

  afterEach(async () => {
    // Cerrar siempre el servidor para liberar el puerto, aunque el test falle.
    if (servidor) {
      await servidor.detener();
      servidor = null;
    }
  });

  it(
    'arranca, escucha en una dirección LAN y publica la URL dentro del límite',
    async () => {
      servidor = crearServidorLocal();

      // Puerto 0: el SO asigna uno libre, evitando colisiones en CI/local.
      const direccion: DireccionAcceso = await servidor.iniciar(0);

      // La DireccionAcceso publicada debe estar completa y bien formada.
      expect(direccion).toBeDefined();
      expect(direccion.puerto).toBeGreaterThan(0);
      expect(direccion.ipLan).toBeDefined();
      expect(direccion.ipLan.length).toBeGreaterThan(0);
      expect(direccion.url).not.toBe('');
      // Formato http://IP:puerto con el puerto realmente asignado.
      expect(direccion.url).toBe(`http://${direccion.ipLan}:${direccion.puerto}`);
      expect(direccion.url).toMatch(/^http:\/\/.+:\d+$/);
    },
    LIMITE_ARRANQUE_MS,
  );

  it(
    'detiene el servidor sin error tras arrancar',
    async () => {
      servidor = crearServidorLocal();
      await servidor.iniciar(0);

      // detener() debe cerrar limpiamente sin lanzar.
      await expect(servidor.detener()).resolves.toBeUndefined();
      // Evitar un segundo detener() en afterEach; ya está cerrado.
      servidor = null;
    },
    LIMITE_ARRANQUE_MS,
  );
});
