import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { crearAplicacion } from '../src/servidor/aplicacion';
import { crearServidorLocal } from '../src/servidor/servidorLocal';
import type { ServidorLocal } from '../src/servidor/tipos';
import type { VistaPartida } from '../src/dominio/proyeccion';
import type { ColorFicha } from '../src/dominio/modelos';

// Prueba de integración END-TO-END de un Golpe completo (tarea 17.4).
//
// Levanta el Servidor_Local REAL (HTTP + WebSocket) cableado con la aplicación
// completa (Coordinador + GestorSesiones + Difusor) y conecta TRES clientes
// WebSocket reales (paquete `ws`). Los tres clientes simulan un Golpe completo:
//
//   unirse al Lobby → INICIAR → tomar una Ficha por Ronda → AVANZAR por cada
//   Ronda (Pre-Flop → Flop → Turn → River → Showdown) → RESOLVER_SHOWDOWN
//
// Y se verifica:
//   - La SINCRONIZACIÓN de estado: todos los clientes reciben el mismo estado
//     autoritativo difundido (lista de Jugadores, Ronda, Golpe, Fichas).
//   - La PRIVACIDAD de las Cartas de Bolsillo: cada cliente ve SU bolsillo (dos
//     Cartas) y los ajenos ocultos ('OCULTO') antes del Showdown; en el
//     Showdown se revelan todos.
//
// _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 8.1, 8.2_

const TIMEOUT_PRUEBA = 20_000;
const TIMEOUT_ESPERA = 8_000;

const BOLSILLO_OCULTO = 'OCULTO';

/** Color de Ficha asociado a cada Ronda con toma de Fichas. */
function colorEsperadoDeRonda(ronda: string): ColorFicha {
  switch (ronda) {
    case 'PRE_FLOP':
      return 'BLANCO';
    case 'FLOP':
      return 'AMARILLO';
    case 'TURN':
      return 'NARANJA';
    default:
      return 'ROJO';
  }
}

/**
 * Cliente WebSocket de prueba que acumula los estados (`ESTADO`) recibidos y
 * permite esperar al siguiente estado que satisfaga un predicado.
 */
class ClientePrueba {
  readonly ws: WebSocket;
  readonly estados: VistaPartida[] = [];
  readonly otros: { tipo: string; payload?: unknown }[] = [];
  #waiters: { pred: (v: VistaPartida) => boolean; resolve: (v: VistaPartida) => void }[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (datos) => {
      const mensaje = JSON.parse(datos.toString()) as { tipo: string; payload?: unknown };
      if (mensaje.tipo === 'ESTADO') {
        const vista = mensaje.payload as VistaPartida;
        this.estados.push(vista);
        this.#waiters = this.#waiters.filter((w) => {
          if (w.pred(vista)) {
            w.resolve(vista);
            return false;
          }
          return true;
        });
      } else {
        this.otros.push(mensaje);
      }
    });
  }

  /** Resuelve cuando la conexión WebSocket está abierta. */
  abierto(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  /** Envía un mensaje cliente → servidor como JSON { tipo, payload }. */
  enviar(tipo: string, payload?: unknown): void {
    const mensaje = payload === undefined ? { tipo } : { tipo, payload };
    this.ws.send(JSON.stringify(mensaje));
  }

  /** La última vista recibida (o lanza si aún no hay ninguna). */
  ultimaVista(): VistaPartida {
    const vista = this.estados[this.estados.length - 1];
    if (vista === undefined) {
      throw new Error('El cliente aún no ha recibido ningún ESTADO.');
    }
    return vista;
  }

  /**
   * Espera hasta recibir un ESTADO que satisfaga el predicado. Si ya se recibió
   * uno, lo devuelve de inmediato.
   */
  esperarEstado(
    pred: (v: VistaPartida) => boolean,
    descripcion = 'estado esperado',
    timeoutMs = TIMEOUT_ESPERA,
  ): Promise<VistaPartida> {
    const existente = this.estados.find(pred);
    if (existente !== undefined) {
      return Promise.resolve(existente);
    }
    return new Promise<VistaPartida>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiters = this.#waiters.filter((w) => w !== waiter);
        reject(new Error(`Timeout esperando: ${descripcion}`));
      }, timeoutMs);
      const waiter = {
        pred,
        resolve: (v: VistaPartida) => {
          clearTimeout(timer);
          resolve(v);
        },
      };
      this.#waiters.push(waiter);
    });
  }

  cerrar(): void {
    try {
      this.ws.close();
    } catch {
      /* sin efecto si ya está cerrada */
    }
  }
}

describe('E2E: un Golpe completo con tres clientes WebSocket', () => {
  let servidor: ServidorLocal;
  let puerto: number;
  let clientes: ClientePrueba[] = [];

  beforeEach(async () => {
    const app = crearAplicacion();
    servidor = crearServidorLocal({ manejadores: app.manejadores });
    const direccion = await servidor.iniciar(0);
    puerto = direccion.puerto;
  });

  afterEach(async () => {
    for (const cliente of clientes) {
      cliente.cerrar();
    }
    clientes = [];
    await servidor.detener();
  });

  it(
    'sincroniza el estado entre los tres clientes y respeta la privacidad de cartas',
    async () => {
      const url = `ws://127.0.0.1:${puerto}`;
      const nombres = ['Lobo', 'Zorro', 'Tejón'];
      clientes = nombres.map(() => new ClientePrueba(url));
      await Promise.all(clientes.map((c) => c.abierto()));

      // --- Paso 3: cada cliente se une al Lobby (uniones secuenciales para un
      // orden determinista). Todos deben acabar viendo los 3 Jugadores
      // (sincronización del Lobby, criterio 3.1 / 2.6).
      for (let i = 0; i < clientes.length; i++) {
        clientes[i]!.enviar('UNIRSE', { nombre: nombres[i] });
        await clientes[i]!.esperarEstado(
          (v) => v.jugadores.length === i + 1,
          `el cliente ${i} ve ${i + 1} jugador(es)`,
        );
      }

      await Promise.all(
        clientes.map((c, i) =>
          c.esperarEstado(
            (v) => v.fase === 'LOBBY' && v.jugadores.length === 3,
            `el cliente ${i} ve los 3 jugadores en el Lobby`,
          ),
        ),
      );

      // Todos ven la misma lista de nombres.
      for (const cliente of clientes) {
        const vista = cliente.ultimaVista();
        expect(new Set(vista.jugadores.map((j) => j.nombre))).toEqual(new Set(nombres));
      }

      // --- Paso 4: un cliente inicia la Partida. Todos ven EN_CURSO, Golpe 1,
      // PRE_FLOP (criterios 3.1, 3.2).
      clientes[0]!.enviar('INICIAR');
      const vistasInicio = await Promise.all(
        clientes.map((c, i) =>
          c.esperarEstado(
            (v) =>
              v.fase === 'EN_CURSO' &&
              v.golpeActual !== null &&
              v.golpeActual.numero === 1 &&
              v.golpeActual.ronda === 'PRE_FLOP',
            `el cliente ${i} ve el Golpe 1 en PRE_FLOP`,
          ),
        ),
      );

      // Identidad propia de cada cliente: su perspectivaJugadorId.
      const ids = vistasInicio.map((v) => v.perspectivaJugadorId);
      expect(new Set(ids).size).toBe(3);

      // --- Paso 5: PRIVACIDAD (criterio 4.2). Cada cliente ve su propio bolsillo
      // (2 cartas) y los ajenos 'OCULTO'.
      vistasInicio.forEach((vista, i) => {
        for (const jugador of vista.jugadores) {
          if (jugador.id === ids[i]) {
            expect(Array.isArray(jugador.bolsillo)).toBe(true);
            expect((jugador.bolsillo as unknown[]).length).toBe(2);
          } else {
            expect(jugador.bolsillo).toBe(BOLSILLO_OCULTO);
          }
        }
      });

      // --- Paso 6: recorrer PRE_FLOP → FLOP → TURN → RIVER → SHOWDOWN.
      // En cada Ronda, cada cliente toma una Ficha única del color activo
      // (estrellas 1..3) y luego un cliente AVANZA (criterios 3.2, 3.3, 3.4).
      const transiciones: { desde: string; hacia: string }[] = [
        { desde: 'PRE_FLOP', hacia: 'FLOP' },
        { desde: 'FLOP', hacia: 'TURN' },
        { desde: 'TURN', hacia: 'RIVER' },
        { desde: 'RIVER', hacia: 'SHOWDOWN' },
      ];

      for (const { desde, hacia } of transiciones) {
        // El color activo se lee de la vista recibida (no se asume).
        const vistaActual = clientes[0]!.ultimaVista();
        expect(vistaActual.golpeActual!.ronda).toBe(desde);
        const colorActivo = vistaActual.golpeActual!.fichas.colorActivo;
        expect(colorActivo).toBe(colorEsperadoDeRonda(desde));

        // Cada cliente toma una Ficha distinta del color activo (estrellas únicas).
        for (let i = 0; i < clientes.length; i++) {
          const estrellas = i + 1;
          const ficha = { color: colorActivo, estrellas };
          clientes[i]!.enviar('TOMAR_FICHA', { ficha });
          await clientes[i]!.esperarEstado(
            (v) =>
              v.golpeActual !== null &&
              (v.golpeActual.fichas.porJugador[ids[i]!] ?? []).some(
                (f) => f.color === colorActivo && f.estrellas === estrellas,
              ),
            `el cliente ${i} posee la ficha ${colorActivo}/${estrellas} en ${desde}`,
          );
        }

        // Un cliente avanza; necesitamos que TODOS confirmen para que la ronda avance.
        for (const cliente of clientes) {
          cliente.enviar('AVANZAR');
        }
        await Promise.all(
          clientes.map((c, i) =>
            c.esperarEstado(
              (v) => v.golpeActual !== null && v.golpeActual.ronda === hacia,
              `el cliente ${i} ve la transición ${desde} → ${hacia}`,
            ),
          ),
        );
      }

      // --- Paso 7: en SHOWDOWN se revelan los bolsillos de TODOS los Jugadores
      // (criterios 8.1, 8.2). Las Fichas rojas (estrellas 1..3) están repartidas
      // y forman el orden del Showdown.
      const vistasShowdown = await Promise.all(
        clientes.map((c, i) =>
          c.esperarEstado(
            (v) => v.golpeActual !== null && v.golpeActual.ronda === 'SHOWDOWN',
            `el cliente ${i} ve el SHOWDOWN`,
          ),
        ),
      );

      vistasShowdown.forEach((vista) => {
        // Al entrar en SHOWDOWN aún no se revelan todas las manos.
        const ocultos = vista.jugadores.filter((j) => j.bolsillo === BOLSILLO_OCULTO);
        expect(ocultos.length).toBeGreaterThan(0);
        const rojasPorJugador = ids.map(
          (id) =>
            (vista.golpeActual!.fichas.porJugador[id!] ?? []).filter(
              (f) => f.color === 'ROJO',
            ).length,
        );
        expect(rojasPorJugador).toEqual([1, 1, 1]);
      });

      // Revelar las tres manos en orden (ficha roja 1→3).
      for (let paso = 1; paso <= 3; paso += 1) {
        clientes[0]!.enviar('REVELAR_SHOWDOWN');
        await Promise.all(
          clientes.map((c, i) =>
            c.esperarEstado(
              (v) => v.golpeActual !== null && v.golpeActual.reveladoShowdown === paso,
              `el cliente ${i} ve revelado ${paso}/3`,
            ),
          ),
        );
      }

      const vistasReveladas = clientes.map((c) => c.ultimaVista());
      vistasReveladas.forEach((vista) => {
        for (const jugador of vista.jugadores) {
          expect(jugador.bolsillo).not.toBe(BOLSILLO_OCULTO);
          expect(Array.isArray(jugador.bolsillo)).toBe(true);
          expect((jugador.bolsillo as unknown[]).length).toBe(2);
        }
      });

      // --- Paso 8: resolver el Showdown.
      // sin condición de fin, la Partida encadena el Golpe 2 en PRE_FLOP y se
      // actualiza exactamente una Bóveda o una Alarma.
      const totalAntes =
        clientes[0]!.ultimaVista().bovedasDoradas + clientes[0]!.ultimaVista().alarmasRojas;
      expect(totalAntes).toBe(0);

      clientes[0]!.enviar('RESOLVER_SHOWDOWN');
      const vistasTrasResolver = await Promise.all(
        clientes.map((c, i) =>
          c.esperarEstado(
            (v) =>
              v.bovedasDoradas + v.alarmasRojas === 1 &&
              v.golpeActual !== null &&
              v.golpeActual.numero === 2 &&
              v.golpeActual.ronda === 'PRE_FLOP',
            `el cliente ${i} ve el Golpe 2 tras resolver el Showdown`,
          ),
        ),
      );

      // Todos los clientes coinciden en el marcador y el Golpe (sincronización).
      const marcadores = vistasTrasResolver.map((v) => ({
        bovedas: v.bovedasDoradas,
        alarmas: v.alarmasRojas,
        golpe: v.golpeActual!.numero,
      }));
      for (const marcador of marcadores) {
        expect(marcador).toEqual(marcadores[0]);
      }
    },
    TIMEOUT_PRUEBA,
  );
});
