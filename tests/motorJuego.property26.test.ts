import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import type {
  ColorFicha,
  EstadoPartida,
  Ficha,
  Jugador,
  ResultadoPartida,
} from '../src/dominio/modelos';
import { aplicarAccion, type Accion } from '../src/dominio/motorJuego';

// Prueba basada en propiedades del Motor_Juego de The Gang (fast-check + Vitest).
// _Requirements: 9.4_
//
// Feature: the-gang-game, Property 26: Para cualquier estado de Partida en fase
// FINALIZADA y cualquier acción posterior, el resultado final y la fase
// permanecen sin cambios y no se inicia ningún Golpe nuevo.

/** Número de Jugadores N: entero entre 3 y 6 (Modo Básico). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/** Resultado final de una Partida finalizada: victoria o derrota del equipo. */
const genResultado: fc.Arbitrary<ResultadoPartida> = fc.constantFrom(
  'VICTORIA',
  'DERROTA',
);

/** Colores de Ficha disponibles (uno por Ronda). */
const COLORES: readonly ColorFicha[] = ['BLANCO', 'AMARILLO', 'NARANJA', 'ROJO'];

/** Genera una Ficha arbitraria (color y estrellas variados). */
const genFicha: fc.Arbitrary<Ficha> = fc.record({
  color: fc.constantFrom(...COLORES),
  estrellas: fc.integer({ min: 1, max: 6 }),
});

/**
 * Genera un estado de Partida en fase FINALIZADA con contadores variados.
 *
 * Un estado finalizado siempre tiene `golpeActual` en null y un `resultado` no
 * nulo (VICTORIA o DERROTA). Los contadores de Bóvedas/Alarmas y los Golpes
 * jugados se varían dentro de rangos plausibles para cubrir distintos finales.
 */
const genEstadoFinalizada: fc.Arbitrary<EstadoPartida> = fc
  .record({
    n: genN,
    resultado: genResultado,
    bovedasDoradas: fc.integer({ min: 0, max: 3 }),
    alarmasRojas: fc.integer({ min: 0, max: 3 }),
    golpesJugados: fc.integer({ min: 1, max: 5 }),
    semilla: fc.string(),
  })
  .map(({ n, resultado, bovedasDoradas, alarmasRojas, golpesJugados, semilla }) => {
    const jugadores: Jugador[] = Array.from({ length: n }, (_, i) => ({
      id: `j${i}`,
      nombre: `Ladron ${i}`,
      bolsillo: null,
    }));
    const estado: EstadoPartida = {
      fase: 'FINALIZADA',
      jugadores,
      golpeActual: null,
      golpesJugados,
      bovedasDoradas,
      alarmasRojas,
      resultado,
      semilla,
    };
    return estado;
  });

/**
 * Genera una acción arbitraria de la unión `Accion`, cubriendo todas las
 * variantes: AVANZAR, RESOLVER_SHOWDOWN, TOMAR_FICHA, INTERCAMBIAR_CENTRO e
 * INTERCAMBIAR_JUGADOR. Los identificadores de Jugador se eligen dentro del
 * rango de Jugadores generados para que las acciones sean plausibles.
 */
const genAccion: fc.Arbitrary<Accion> = fc.oneof(
  fc.constant<Accion>({ tipo: 'AVANZAR' }),
  fc.constant<Accion>({ tipo: 'RESOLVER_SHOWDOWN' }),
  fc.record({ jugador: fc.integer({ min: 0, max: 5 }), ficha: genFicha }).map(
    ({ jugador, ficha }): Accion => ({
      tipo: 'TOMAR_FICHA',
      jugadorId: `j${jugador}`,
      ficha,
    }),
  ),
  fc.record({ jugador: fc.integer({ min: 0, max: 5 }), fichaCentro: genFicha }).map(
    ({ jugador, fichaCentro }): Accion => ({
      tipo: 'INTERCAMBIAR_CENTRO',
      jugadorId: `j${jugador}`,
      fichaCentro,
    }),
  ),
  fc
    .record({ a: fc.integer({ min: 0, max: 5 }), b: fc.integer({ min: 0, max: 5 }) })
    .map(({ a, b }): Accion => ({
      tipo: 'INTERCAMBIAR_JUGADOR',
      jugadorA: `j${a}`,
      jugadorB: `j${b}`,
    })),
);

describe('Property 26: El estado finalizado es estable', () => {
  it('cualquier acción sobre una Partida FINALIZADA es rechazada y no altera el estado', () => {
    verificarPropiedad(
      fc.property(genEstadoFinalizada, genAccion, (estado, accion) => {
        // Copia profunda de los campos relevantes para detectar cualquier mutación.
        const fasePrevia = estado.fase;
        const resultadoPrevio = estado.resultado;
        const bovedasPrevias = estado.bovedasDoradas;
        const alarmasPrevias = estado.alarmasRojas;
        const golpesPrevios = estado.golpesJugados;

        const resultado = aplicarAccion(estado, accion);

        // La acción posterior a la finalización debe ser rechazada (criterio 9.4).
        expect(resultado.ok).toBe(false);
        if (resultado.ok) {
          return;
        }
        expect(resultado.error.codigo).toBe('PARTIDA_FINALIZADA');

        // El estado original no se muta: fase, resultado y contadores intactos,
        // y no se inicia ningún Golpe nuevo (golpeActual sigue null).
        expect(estado.fase).toBe(fasePrevia);
        expect(estado.resultado).toBe(resultadoPrevio);
        expect(estado.bovedasDoradas).toBe(bovedasPrevias);
        expect(estado.alarmasRojas).toBe(alarmasPrevias);
        expect(estado.golpesJugados).toBe(golpesPrevios);
        expect(estado.golpeActual).toBeNull();
      }),
    );
  });
});
