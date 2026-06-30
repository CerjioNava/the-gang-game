import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { type Carta } from '../src/dominio/modelos';
import { TOTAL_CARTAS_BARAJA, construirBaraja } from '../src/dominio/baraja';
import {
  crearBarajaBarajada,
  repartirBolsillos,
  revelarFlop,
  revelarTurn,
  revelarRiver,
  CARTAS_BOLSILLO_POR_JUGADOR,
  COMUNITARIAS_FLOP,
  COMUNITARIAS_TURN,
  COMUNITARIAS_RIVER,
} from '../src/dominio/reparto';

// Pruebas basadas en propiedades del reparto de cartas (fast-check + Vitest).
// _Requirements: 4.1, 4.3, 4.4, 4.5_

/** Clave canónica única de una carta (palo + valor) para detectar repeticiones. */
function claveCarta(carta: Carta): string {
  return `${carta.palo}-${carta.valor}`;
}

/** Generador de semillas arbitrarias: número o cadena. */
const genSemilla = fc.oneof(fc.integer(), fc.double(), fc.string());

/** Generador del número de Jugadores N entre 3 y 6 (Modo Básico). */
const genN = fc.integer({ min: 3, max: 6 });

describe('Reparto de cartas (PBT)', () => {
  // Feature: the-gang-game, Property 1: Para cualquier semilla de barajado y cualquier número de jugadores N entre 3 y 6, tras repartir las Cartas de Bolsillo y revelar las Cartas Comunitarias de cada Ronda, todas las cartas en juego (bolsillos + comunitarias + mazo restante) son distintas entre sí, pertenecen a la baraja de 52, cada Jugador tiene exactamente 2 Cartas de Bolsillo, y el número de Cartas Comunitarias es 3 tras el Flop, 4 tras el Turn y 5 tras el River.
  // Validates: Requirements 4.1, 4.3, 4.4, 4.5
  it('Property 1: no repetición y conteo correcto de cartas', () => {
    // Conjunto de claves canónicas de la baraja completa de 52 cartas.
    const clavesBaraja = new Set(construirBaraja().map(claveCarta));

    verificarPropiedad(
      fc.property(genSemilla, genN, (semilla, n) => {
        // Reparto: barajar, repartir bolsillos y revelar Flop, Turn y River.
        const baraja = crearBarajaBarajada(semilla);
        const { bolsillos, resto: restoTrasBolsillos } = repartirBolsillos(
          baraja,
          n,
        );

        const flop = revelarFlop(restoTrasBolsillos);
        const turn = revelarTurn(flop.comunitarias, flop.resto);
        const river = revelarRiver(turn.comunitarias, turn.resto);

        // Conteo de Cartas de Bolsillo: cada Jugador tiene exactamente 2.
        expect(bolsillos).toHaveLength(n);
        for (const bolsillo of bolsillos) {
          expect(bolsillo).toHaveLength(CARTAS_BOLSILLO_POR_JUGADOR);
        }

        // Conteo de Cartas Comunitarias por Ronda: 3 (Flop), 4 (Turn), 5 (River).
        expect(flop.comunitarias).toHaveLength(COMUNITARIAS_FLOP);
        expect(turn.comunitarias).toHaveLength(COMUNITARIAS_TURN);
        expect(river.comunitarias).toHaveLength(COMUNITARIAS_RIVER);

        // Unión de todas las cartas en juego: bolsillos + comunitarias + mazo restante.
        const todas: Carta[] = [
          ...bolsillos.flat(),
          ...river.comunitarias,
          ...river.resto,
        ];

        // El total debe ser exactamente la baraja de 52 cartas.
        expect(todas).toHaveLength(TOTAL_CARTAS_BARAJA);

        // Sin duplicados: todas las cartas en juego son distintas entre sí.
        const claves = todas.map(claveCarta);
        const clavesUnicas = new Set(claves);
        expect(clavesUnicas.size).toBe(todas.length);

        // Todas pertenecen a la baraja de 52 cartas.
        for (const clave of claves) {
          expect(clavesBaraja.has(clave)).toBe(true);
        }
      }),
    );
  });
});
