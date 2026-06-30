import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import {
  proyectarEstadoPara,
  BOLSILLO_OCULTO,
} from '../src/dominio/proyeccion';
import { iniciarPartida } from '../src/dominio/motorJuego';
import type { Carta, EstadoPartida, Jugador, Ronda, Semilla } from '../src/dominio/modelos';

// Prueba basada en propiedades de la proyección de vistas por Jugador.
// _Requirements: 4.2, 4.6_
//
// Feature: the-gang-game, Property 2: Para cualquier estado de Partida cuyo
// Golpe no ha llegado al Showdown y cualquier par de Jugadores distintos A y B,
// la vista de estado que el Servidor_Local envía al Cliente de A no contiene las
// Cartas de Bolsillo de B.

/** Genera el número de Jugadores N: entero entre 3 y 6. */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/** Genera una semilla para el barajado determinista (número o cadena). */
const genSemilla: fc.Arbitrary<Semilla> = fc.oneof(
  fc.integer(),
  fc.string({ minLength: 1, maxLength: 16 }),
);

/** Rondas en las que el Golpe NO ha llegado al Showdown (criterios 4.2, 4.6). */
const RONDAS_PRE_SHOWDOWN: readonly Ronda[] = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'];

/** Genera una Ronda distinta de SHOWDOWN. */
const genRondaPreShowdown: fc.Arbitrary<Ronda> = fc.constantFrom(
  ...RONDAS_PRE_SHOWDOWN,
);

/** Serializa una Carta a un texto comparable para detectar fugas en la vista. */
function claveCarta(carta: Carta): string {
  return `${carta.valor}-${carta.palo}`;
}

describe('Property 2: Privacidad de las Cartas de Bolsillo antes del Showdown', () => {
  it('la vista de A no contiene las Cartas de Bolsillo de B mientras el Golpe no es Showdown', () => {
    verificarPropiedad(
      fc.property(
        genN,
        genSemilla,
        genRondaPreShowdown,
        // aIdx en 0..n-1; offset en 1..n-1 garantiza B distinto de A.
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (n, semilla, ronda, aRaw, offsetRaw) => {
          // Construir N Jugadores; iniciarPartida reparte las Cartas de Bolsillo.
          const jugadores: Jugador[] = Array.from({ length: n }, (_, i) => ({
            id: `jugador-${i}`,
            nombre: `Ladron ${i}`,
            bolsillo: null,
          }));

          const base = iniciarPartida(jugadores, semilla);

          // Forzar la Ronda generada (nunca SHOWDOWN) manteniendo el resto del
          // estado autoritativo intacto.
          const estado: EstadoPartida = {
            ...base,
            golpeActual: { ...base.golpeActual!, ronda },
          };
          // Precondición de la propiedad: el Golpe no ha llegado al Showdown.
          expect(estado.golpeActual!.ronda).not.toBe('SHOWDOWN');

          // Elegir un par de Jugadores distintos A y B.
          const aIdx = aRaw % n;
          const bIdx = (aIdx + (offsetRaw % (n - 1)) + 1) % n;
          expect(aIdx).not.toBe(bIdx);

          const jugadorA = estado.jugadores[aIdx]!;
          const jugadorB = estado.jugadores[bIdx]!;

          // Proyectar el estado para el Cliente de A.
          const vista = proyectarEstadoPara(estado, jugadorA.id);

          const visibleA = vista.jugadores.find((j) => j.id === jugadorA.id)!;
          const visibleB = vista.jugadores.find((j) => j.id === jugadorB.id)!;

          // Las Cartas de Bolsillo de B están ocultas: nunca aparecen sus valores.
          expect(visibleB.bolsillo).toBe(BOLSILLO_OCULTO);

          // Las Cartas de Bolsillo propias de A SÍ son visibles e iguales a las
          // del estado autoritativo.
          expect(Array.isArray(visibleA.bolsillo)).toBe(true);
          expect(visibleA.bolsillo).toEqual(jugadorA.bolsillo);

          // Verificación reforzada: el texto serializado de la vista completa no
          // contiene ninguna de las dos Cartas de Bolsillo reales de B.
          const vistaSerializada = JSON.stringify(vista);
          const cartasDeB = jugadorB.bolsillo!;
          for (const carta of cartasDeB) {
            // Las cartas son únicas en la baraja; las de B no coinciden con las
            // de A, por lo que su presencia indicaría una fuga de privacidad.
            const apareceEnVistaDeB =
              Array.isArray(visibleB.bolsillo) &&
              visibleB.bolsillo.some(
                (c) => claveCarta(c) === claveCarta(carta),
              );
            expect(apareceEnVistaDeB).toBe(false);
            // Comprobación adicional sobre el JSON: la carta de B no debe estar
            // salvo que A comparta exactamente ese valor+palo (imposible: baraja
            // sin repetición), por lo que verificamos que no es una de A.
            const esCartaDeA = cartasDeA(jugadorA).some(
              (c) => claveCarta(c) === claveCarta(carta),
            );
            if (!esCartaDeA) {
              expect(vistaSerializada).not.toContain(
                `"valor":${carta.valor},"palo":"${carta.palo}"`,
              );
            }
          }
        },
      ),
    );
  });
});

/** Devuelve las Cartas de Bolsillo de un Jugador (no nulas tras iniciarPartida). */
function cartasDeA(jugador: Jugador): Carta[] {
  return jugador.bolsillo ?? [];
}
