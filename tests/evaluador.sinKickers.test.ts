// Pruebas de la función compararSinKickers del Evaluador_Manos.
//
// Verifican que cuando la regla "Sin Kickers" está activa:
// - Dos manos que empatan en categoría y valor de categoría se desempatan por
//   las cartas de bolsillo (en orden descendente de valor).
// - Si las cartas de bolsillo también empatan → Empate Verdadero (retorna 0).
// - Si las categorías difieren, la categoría decide directamente sin mirar bolsillos.

import { describe, it, expect } from 'vitest';
import { compararSinKickers, evaluar } from '../src/dominio/evaluador';
import type { Carta, ManoEvaluada } from '../src/dominio/modelos';

// ===========================================================================
// Helpers
// ===========================================================================

function carta(valor: number, palo: Carta['palo'] = 'PICAS'): Carta {
  return { valor, palo };
}

/** Evalúa y devuelve la ManoEvaluada a partir de bolsillo + comunitarias. */
function evaluarMano(bolsillo: [Carta, Carta], comunitarias: Carta[]): ManoEvaluada {
  const resultado = evaluar(bolsillo, comunitarias);
  if (!resultado.ok) {
    throw new Error('No se pudo evaluar la mano');
  }
  return resultado.mano;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('compararSinKickers', () => {
  describe('Empate en Par de Ases: desempate por bolsillos', () => {
    // Mesa: A♠ 8♥ J♦ Q♣ 2♠ → ambos forman Par de Ases con un As de bolsillo.
    const comunitarias: Carta[] = [
      carta(14, 'PICAS'),   // As
      carta(8, 'CORAZONES'),
      carta(11, 'DIAMANTES'),
      carta(12, 'TREBOLES'),
      carta(2, 'PICAS'),
    ];

    it('Jugador con (A,6) gana a Jugador con (A,3): segunda carta de bolsillo decide', () => {
      const bolsilloA: [Carta, Carta] = [carta(14, 'CORAZONES'), carta(3, 'TREBOLES')];
      const bolsilloB: [Carta, Carta] = [carta(14, 'DIAMANTES'), carta(6, 'DIAMANTES')];

      const manoA = evaluarMano(bolsilloA, comunitarias);
      const manoB = evaluarMano(bolsilloB, comunitarias);

      // Ambos tienen Par de Ases.
      expect(manoA.categoria).toBe(manoB.categoria);

      // Sin kickers: B tiene bolsillo (A,6) vs A tiene (A,3) → B mayor.
      const resultado = compararSinKickers(manoA, manoB, bolsilloA, bolsilloB);
      expect(resultado).toBeLessThan(0); // A es más débil que B.
    });

    it('Jugador con (K,5) gana a Jugador con (K,3): K=K, 5>3', () => {
      const bolsilloA: [Carta, Carta] = [carta(13, 'CORAZONES'), carta(3, 'TREBOLES')];
      const bolsilloB: [Carta, Carta] = [carta(13, 'DIAMANTES'), carta(5, 'DIAMANTES')];

      const manoA = evaluarMano(bolsilloA, comunitarias);
      const manoB = evaluarMano(bolsilloB, comunitarias);

      // Ambos: Carta Alta (misma mejor mano de 5: A, K, Q, J, 8).
      expect(manoA.categoria).toBe(manoB.categoria);

      // Sin kickers: B (K,5) vs A (K,3) → la alta K=K, baja 5>3 → B mayor.
      const resultado = compararSinKickers(manoA, manoB, bolsilloA, bolsilloB);
      expect(resultado).toBeLessThan(0); // A es más débil que B.
    });
  });

  describe('Empate verdadero: bolsillos idénticos en valor', () => {
    const comunitarias: Carta[] = [
      carta(14, 'PICAS'),
      carta(8, 'CORAZONES'),
      carta(11, 'DIAMANTES'),
      carta(12, 'TREBOLES'),
      carta(2, 'PICAS'),
    ];

    it('Bolsillos (K,5) vs (K,5) con distintos palos → empate verdadero (0)', () => {
      const bolsilloA: [Carta, Carta] = [carta(13, 'CORAZONES'), carta(5, 'TREBOLES')];
      const bolsilloB: [Carta, Carta] = [carta(13, 'DIAMANTES'), carta(5, 'PICAS')];

      const manoA = evaluarMano(bolsilloA, comunitarias);
      const manoB = evaluarMano(bolsilloB, comunitarias);

      const resultado = compararSinKickers(manoA, manoB, bolsilloA, bolsilloB);
      expect(resultado).toBe(0);
    });
  });

  describe('Categorías distintas: la categoría decide sin mirar bolsillos', () => {
    it('Trío (categoría 3) vence a Par (categoría 1) sin importar bolsillos', () => {
      // Mesa con un par de 7 para que un bolsillo con 7 haga trío.
      const comunitarias: Carta[] = [
        carta(7, 'PICAS'),
        carta(7, 'CORAZONES'),
        carta(2, 'DIAMANTES'),
        carta(4, 'TREBOLES'),
        carta(9, 'PICAS'),
      ];

      // Jugador A: tiene (7, 3) → Trío de 7s.
      const bolsilloA: [Carta, Carta] = [carta(7, 'DIAMANTES'), carta(3, 'TREBOLES')];
      // Jugador B: tiene (14, 13) → Par de 7s (con kickers altos, pero sin tercer 7).
      const bolsilloB: [Carta, Carta] = [carta(14, 'DIAMANTES'), carta(13, 'TREBOLES')];

      const manoA = evaluarMano(bolsilloA, comunitarias);
      const manoB = evaluarMano(bolsilloB, comunitarias);

      // A tiene trío, B tiene par → categorías distintas.
      expect(manoA.categoria).toBeGreaterThan(manoB.categoria);

      // compararSinKickers igualmente debe respetar la categoría.
      const resultado = compararSinKickers(manoA, manoB, bolsilloA, bolsilloB);
      expect(resultado).toBeGreaterThan(0); // A es más fuerte.
    });
  });

  describe('Orden de bolsillo: la carta más alta se compara primero', () => {
    const comunitarias: Carta[] = [
      carta(14, 'PICAS'),
      carta(8, 'CORAZONES'),
      carta(11, 'DIAMANTES'),
      carta(12, 'TREBOLES'),
      carta(2, 'PICAS'),
    ];

    it('Bolsillo (3, 10) vs (9, 4): max(3,10)=10 vs max(9,4)=9 → primer jugador mayor', () => {
      const bolsilloA: [Carta, Carta] = [carta(3, 'CORAZONES'), carta(10, 'TREBOLES')];
      const bolsilloB: [Carta, Carta] = [carta(9, 'DIAMANTES'), carta(4, 'PICAS')];

      const manoA = evaluarMano(bolsilloA, comunitarias);
      const manoB = evaluarMano(bolsilloB, comunitarias);

      // Ambos Par de Ases (As viene de la mesa).
      expect(manoA.categoria).toBe(manoB.categoria);

      const resultado = compararSinKickers(manoA, manoB, bolsilloA, bolsilloB);
      expect(resultado).toBeGreaterThan(0); // A mayor porque 10 > 9 en alta.
    });
  });
});
