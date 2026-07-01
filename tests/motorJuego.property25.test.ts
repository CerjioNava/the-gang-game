import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import type {
  Carta,
  EstadoFichas,
  EstadoGolpe,
  EstadoPartida,
  Jugador,
  ManoEvaluada,
} from '../src/dominio/modelos';
import { construirBaraja } from '../src/dominio/baraja';
import { evaluar, comparar } from '../src/dominio/evaluador';
import { resolverShowdown } from '../src/dominio/showdown';
import { aplicarAccion } from '../src/dominio/motorJuego';

// Prueba basada en propiedades del Motor_Juego de The Gang (fast-check + Vitest).
// _Requirements: 9.1, 9.2_
//
// Feature: the-gang-game, Property 25: Para cualquier estado de Partida, si el
// número de Bóvedas doradas alcanza tres entonces la Partida finaliza con
// resultado de victoria, y si el número de Alarmas rojas alcanza tres entonces
// la Partida finaliza con resultado de derrota.

/** Baraja completa de 52 cartas distintas, indexable para muestrear sin repetición. */
const BARAJA: readonly Carta[] = construirBaraja();

/** Cartas Comunitarias en el Showdown (las cinco reveladas). */
const NUM_COMUNITARIAS = 5;
/** Cartas máximas necesarias: 5 comunitarias + 2 por cada uno de hasta 6 Jugadores. */
const NUM_CARTAS_MAX = NUM_COMUNITARIAS + 2 * 6;

/** Genera el número de Jugadores N: entero entre 3 y 6 (Modo Básico). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/**
 * Genera 17 cartas distintas de la baraja de 52 (5 comunitarias + 2 por Jugador
 * para hasta 6 Jugadores), muestreando índices únicos en 0..51. La unicidad de
 * índices garantiza cartas distintas (sin repeticiones entre bolsillos y mesa).
 */
const genCartasDistintas: fc.Arbitrary<Carta[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: BARAJA.length - 1 }), {
    minLength: NUM_CARTAS_MAX,
    maxLength: NUM_CARTAS_MAX,
  })
  .map((indices) => indices.map((i) => BARAJA[i] as Carta));

/** Escenario de fin de Partida a verificar. */
type Escenario = 'VICTORIA' | 'DERROTA';
const genEscenario: fc.Arbitrary<Escenario> = fc.constantFrom('VICTORIA', 'DERROTA');

/**
 * Construye un estado de Partida en SHOWDOWN listo para resolver, repartiendo
 * cartas distintas y asignando las Fichas rojas según el escenario:
 *
 * - VICTORIA: se asignan las estrellas rojas en orden ascendente con la fuerza
 *   real de las manos (la más débil con 1 estrella). Así el orden del Showdown
 *   es no decreciente en fuerza y el Golpe es exitoso. Partiendo de 2 Bóvedas
 *   doradas, resolver lleva a la tercera Bóveda → victoria.
 * - DERROTA: se asignan las estrellas rojas en orden inverso a la fuerza (la más
 *   fuerte con 1 estrella). Si no todas las manos empatan, el orden del Showdown
 *   presenta una inversión y el Golpe fracasa. Partiendo de 2 Alarmas rojas,
 *   resolver lleva a la tercera Alarma → derrota.
 */
function construirEstadoShowdown(
  n: number,
  cartas: Carta[],
  escenario: Escenario,
): { estado: EstadoPartida; jugadores: Jugador[]; golpe: EstadoGolpe } {
  const comunitarias = cartas.slice(0, NUM_COMUNITARIAS);

  const jugadores: Jugador[] = Array.from({ length: n }, (_, i) => {
    const base = NUM_COMUNITARIAS + 2 * i;
    return {
      id: `j${i}`,
      nombre: `Ladron ${i}`,
      bolsillo: [cartas[base] as Carta, cartas[base + 1] as Carta],
    };
  });

  // Fuerza real de cada Jugador según el Evaluador_Manos.
  const manos: ManoEvaluada[] = jugadores.map((jugador) => {
    const resultado = evaluar(jugador.bolsillo, comunitarias);
    if (!resultado.ok) {
      throw new Error('Cartas insuficientes para construir el escenario de Showdown.');
    }
    return resultado.mano;
  });

  // Índices de Jugadores ordenados de forma ascendente por fuerza de la mano.
  const indicesPorFuerza = jugadores
    .map((_, i) => i)
    .sort((a, b) => comparar(manos[a] as ManoEvaluada, manos[b] as ManoEvaluada));

  // Asignación de estrellas rojas (1..N) a cada Jugador según el escenario.
  const estrellasPorJugador = new Array<number>(n);
  indicesPorFuerza.forEach((idxJugador, posicion) => {
    // VICTORIA: estrella creciente con la fuerza (más débil = 1 estrella).
    // DERROTA: estrella decreciente con la fuerza (más fuerte = 1 estrella).
    estrellasPorJugador[idxJugador] =
      escenario === 'VICTORIA' ? posicion + 1 : n - posicion;
  });

  const porJugador: Record<string, import('../src/dominio/modelos').Ficha[]> = {};
  jugadores.forEach((jugador, i) => {
    porJugador[jugador.id] = [{ color: 'ROJO', estrellas: estrellasPorJugador[i] as number }];
  });

  const fichas: EstadoFichas = {
    numJugadores: n,
    centro: [],
    porJugador,
    colorActivo: 'ROJO',
  };

  const golpe: EstadoGolpe = {
    numero: 1,
    ronda: 'SHOWDOWN',
    baraja: [],
    comunitarias,
    fichas,
    confirmados: [],
  };

  const estado: EstadoPartida = {
    fase: 'EN_CURSO',
    jugadores,
    golpeActual: golpe,
    golpesJugados: 0,
    // VICTORIA: ya hay 2 Bóvedas; un Golpe exitoso alcanza la tercera.
    bovedasDoradas: escenario === 'VICTORIA' ? 2 : 0,
    // DERROTA: ya hay 2 Alarmas; un Golpe fracasado alcanza la tercera.
    alarmasRojas: escenario === 'DERROTA' ? 2 : 0,
    resultado: null,
    semilla: 'property25',
  };

  return { estado, jugadores, golpe };
}

describe('Property 25: Condiciones de fin de Partida', () => {
  it('tres Bóvedas doradas finalizan en VICTORIA y tres Alarmas rojas en DERROTA', () => {
    verificarPropiedad(
      fc.property(genN, genCartasDistintas, genEscenario, (n, cartas, escenario) => {
        const { estado, jugadores, golpe } = construirEstadoShowdown(n, cartas, escenario);

        // Confirma que el showdown produce el signo esperado para el escenario.
        // En DERROTA, si todas las manos empatan (sin inversión posible) el
        // Golpe sería exitoso; esos casos se descartan para aislar la propiedad.
        const showdown = resolverShowdown(jugadores, golpe);
        const exitoEsperado = escenario === 'VICTORIA';
        fc.pre(showdown.exito === exitoEsperado);

        const resultado = aplicarAccion(estado, { tipo: 'RESOLVER_SHOWDOWN' });
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) {
          return;
        }

        const nuevo = resultado.estado;
        if (escenario === 'VICTORIA') {
          // Al alcanzar exactamente tres Bóvedas doradas, la Partida finaliza con
          // resultado de victoria (criterio 9.1).
          expect(nuevo.bovedasDoradas).toBe(3);
          expect(nuevo.resultado).toBe('VICTORIA');
          expect(nuevo.fase).toBe('FINALIZADA');
        } else {
          // Al alcanzar exactamente tres Alarmas rojas, la Partida finaliza con
          // resultado de derrota (criterio 9.2).
          expect(nuevo.alarmasRojas).toBe(3);
          expect(nuevo.resultado).toBe('DERROTA');
          expect(nuevo.fase).toBe('FINALIZADA');
        }
      }),
      { numRuns: 200 },
    );
  });
});
