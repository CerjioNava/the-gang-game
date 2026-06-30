// Construcción de la baraja completa de The Gang.
// _Requirements: 4.1_

import { PALOS, VALOR_MAXIMO, VALOR_MINIMO, type Carta } from './modelos';

/** Número total de cartas de una baraja francesa completa. */
export const TOTAL_CARTAS_BARAJA = 52;

/**
 * Construye la baraja completa de 52 cartas distintas.
 *
 * Recorre los cuatro palos y los valores 2..14, produciendo exactamente una
 * carta por combinación (palo, valor). El orden es determinista: por palo y,
 * dentro de cada palo, por valor ascendente. El barajado se aplica por
 * separado mediante una semilla (tarea 3.1).
 */
export function construirBaraja(): Carta[] {
  const baraja: Carta[] = [];
  for (const palo of PALOS) {
    for (let valor = VALOR_MINIMO; valor <= VALOR_MAXIMO; valor++) {
      baraja.push({ valor, palo });
    }
  }
  return baraja;
}
