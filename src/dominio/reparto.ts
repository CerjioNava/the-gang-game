// Reparto de cartas: Cartas de Bolsillo y revelado incremental de Comunitarias.
//
// Funciones puras que operan sobre una baraja ya barajada (ver `barajado.ts`).
// Reparten 2 Cartas de Bolsillo por Jugador y revelan las Cartas Comunitarias
// de forma incremental (3 en el Flop, 4 en el Turn, 5 en el River) extrayendo
// cartas del mazo restante sin repetir ninguna ya repartida o revelada.
// _Requirements: 4.1, 4.3, 4.4, 4.5_

import { type Carta, type Ronda, type Semilla } from './modelos';
import { construirBaraja } from './baraja';
import { barajar } from './barajado';

/** Número de Cartas de Bolsillo por Jugador. */
export const CARTAS_BOLSILLO_POR_JUGADOR = 2;

/** Número de Cartas Comunitarias reveladas tras el Flop. */
export const COMUNITARIAS_FLOP = 3;
/** Número de Cartas Comunitarias reveladas tras el Turn. */
export const COMUNITARIAS_TURN = 4;
/** Número de Cartas Comunitarias reveladas tras el River. */
export const COMUNITARIAS_RIVER = 5;

/** Resultado de repartir las Cartas de Bolsillo a todos los Jugadores. */
export interface RepartoBolsillos {
  /** Pares de Cartas de Bolsillo, uno por Jugador, en el orden recibido. */
  bolsillos: [Carta, Carta][];
  /** Cartas que quedan en el mazo tras el reparto. */
  resto: Carta[];
}

/** Resultado de revelar Cartas Comunitarias. */
export interface RevelarComunitarias {
  /** Cartas Comunitarias visibles tras el revelado. */
  comunitarias: Carta[];
  /** Cartas que quedan en el mazo tras el revelado. */
  resto: Carta[];
}

/**
 * Crea una baraja completa de 52 cartas y la baraja de forma determinista a
 * partir de `semilla`. Conveniencia para iniciar un Golpe de forma reproducible.
 */
export function crearBarajaBarajada(semilla: Semilla): Carta[] {
  return barajar(construirBaraja(), semilla);
}

/**
 * Reparte exactamente 2 Cartas de Bolsillo a cada uno de los `numJugadores`
 * Jugadores, extrayéndolas del frente del mazo sin repetición, y devuelve el
 * mazo restante. No muta la baraja de entrada.
 *
 * @throws si `numJugadores` no es un entero positivo o si la baraja no tiene
 *   cartas suficientes para repartir 2 por Jugador.
 */
export function repartirBolsillos(
  baraja: readonly Carta[],
  numJugadores: number,
): RepartoBolsillos {
  if (!Number.isInteger(numJugadores) || numJugadores < 1) {
    throw new Error(
      `numJugadores debe ser un entero positivo, recibido: ${numJugadores}`,
    );
  }
  const necesarias = numJugadores * CARTAS_BOLSILLO_POR_JUGADOR;
  if (baraja.length < necesarias) {
    throw new Error(
      `Baraja insuficiente: se requieren ${necesarias} cartas y hay ${baraja.length}`,
    );
  }

  const bolsillos: [Carta, Carta][] = [];
  for (let j = 0; j < numJugadores; j++) {
    const primera = baraja[j * CARTAS_BOLSILLO_POR_JUGADOR]!;
    const segunda = baraja[j * CARTAS_BOLSILLO_POR_JUGADOR + 1]!;
    bolsillos.push([primera, segunda]);
  }
  const resto = baraja.slice(necesarias);
  return { bolsillos, resto };
}

/**
 * Revela Cartas Comunitarias hasta alcanzar `objetivo` cartas en total,
 * extrayendo del frente del mazo restante las que falten, sin repetir las ya
 * reveladas. No muta las entradas.
 *
 * @throws si `objetivo` es menor que las comunitarias actuales o si el mazo no
 *   tiene cartas suficientes.
 */
function revelarHasta(
  comunitarias: readonly Carta[],
  resto: readonly Carta[],
  objetivo: number,
): RevelarComunitarias {
  const faltan = objetivo - comunitarias.length;
  if (faltan < 0) {
    throw new Error(
      `Ya hay ${comunitarias.length} Cartas Comunitarias, no se puede reducir a ${objetivo}`,
    );
  }
  if (resto.length < faltan) {
    throw new Error(
      `Mazo insuficiente: se requieren ${faltan} cartas y hay ${resto.length}`,
    );
  }
  return {
    comunitarias: [...comunitarias, ...resto.slice(0, faltan)],
    resto: resto.slice(faltan),
  };
}

/**
 * Revela las 3 Cartas Comunitarias del Flop a partir del mazo restante.
 * _Requirements: 4.3_
 */
export function revelarFlop(resto: readonly Carta[]): RevelarComunitarias {
  return revelarHasta([], resto, COMUNITARIAS_FLOP);
}

/**
 * Revela la 4.ª Carta Comunitaria (Turn), sumándola a las 3 del Flop.
 * _Requirements: 4.4_
 */
export function revelarTurn(
  comunitarias: readonly Carta[],
  resto: readonly Carta[],
): RevelarComunitarias {
  return revelarHasta(comunitarias, resto, COMUNITARIAS_TURN);
}

/**
 * Revela la 5.ª Carta Comunitaria (River), sumándola a las 4 previas.
 * _Requirements: 4.5_
 */
export function revelarRiver(
  comunitarias: readonly Carta[],
  resto: readonly Carta[],
): RevelarComunitarias {
  return revelarHasta(comunitarias, resto, COMUNITARIAS_RIVER);
}

/**
 * Número de Cartas Comunitarias que deben estar reveladas en una Ronda dada.
 * Pre-Flop no tiene Comunitarias; Flop 3, Turn 4, River y Showdown 5.
 */
export function comunitariasEsperadas(ronda: Ronda): number {
  switch (ronda) {
    case 'PRE_FLOP':
      return 0;
    case 'FLOP':
      return COMUNITARIAS_FLOP;
    case 'TURN':
      return COMUNITARIAS_TURN;
    case 'RIVER':
    case 'SHOWDOWN':
      return COMUNITARIAS_RIVER;
  }
}

/**
 * Revela las Cartas Comunitarias correspondientes a `ronda`, completando desde
 * las `comunitarias` actuales hasta el número esperado para esa Ronda.
 * _Requirements: 4.3, 4.4, 4.5_
 */
export function revelarComunitariasPorRonda(
  ronda: Ronda,
  comunitarias: readonly Carta[],
  resto: readonly Carta[],
): RevelarComunitarias {
  return revelarHasta(comunitarias, resto, comunitariasEsperadas(ronda));
}
