import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { type Carta, type Palo, type ManoEvaluada } from '../src/dominio/modelos';
import { construirBaraja } from '../src/dominio/baraja';
import { comparar, esEmpateVerdadero, clasificarCinco } from '../src/dominio/evaluador';

// Prueba basada en propiedades de la detección de Empate_Verdadero (fast-check + Vitest).
// _Requirements: 7.4_
//
// Feature: the-gang-game, Property 19: Para cualquier par de manos evaluadas A y B, A y B forman un Empate_Verdadero si y solo si la comparación entre A y B es de igualdad (misma categoría y mismos valores de cartas).

/** Baraja completa de 52 cartas distintas, usada para muestrear manos. */
const BARAJA: readonly Carta[] = construirBaraja();

/**
 * Genera una mano evaluada a partir de 5 cartas distintas tomadas de la baraja.
 * Se eligen 5 índices distintos en 0..51 y se clasifican con `clasificarCinco`,
 * produciendo manos variadas (escaleras, colores, pares, etc.).
 */
const genMano: fc.Arbitrary<ManoEvaluada> = fc
  .uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 5, maxLength: 5 })
  .map((indices) => clasificarCinco(indices.map((i) => BARAJA[i] as Carta)));

/** Construye 5 cartas (no Color) a partir de valores dados, con palos variados. */
function manoNoColor(valores: readonly number[]): Carta[] {
  const palos: Palo[] = ['PICAS', 'CORAZONES', 'DIAMANTES', 'TREBOLES', 'PICAS'];
  return valores.map((valor, i) => ({ valor, palo: palos[i] as Palo }));
}

describe('Property 19: Empate Verdadero equivale a comparación nula', () => {
  it('bicondicional: esEmpateVerdadero(a,b) <=> comparar(a,b) === 0', () => {
    verificarPropiedad(
      fc.property(genMano, genMano, (a, b) => {
        expect(esEmpateVerdadero(a, b)).toBe(comparar(a, b) === 0);
      }),
    );
  });

  it('reflexivo: toda mano forma Empate_Verdadero consigo misma', () => {
    verificarPropiedad(
      fc.property(genMano, (a) => {
        expect(esEmpateVerdadero(a, a)).toBe(true);
        expect(comparar(a, a)).toBe(0);
      }),
    );
  });

  it('simétrico: esEmpateVerdadero(a,b) === esEmpateVerdadero(b,a)', () => {
    verificarPropiedad(
      fc.property(genMano, genMano, (a, b) => {
        expect(esEmpateVerdadero(a, b)).toBe(esEmpateVerdadero(b, a));
      }),
    );
  });

  it('caso construido: dos manos con los mismos valores en palos distintos (sin Color) son Empate_Verdadero', () => {
    // Mismos cinco valores (carta alta K-Q-9-7-3) repartidos en palos distintos
    // de modo que ninguna de las dos manos forma Color. Deben ser iguales.
    const valores = [13, 12, 9, 7, 3];
    const manoA: Carta[] = [
      { valor: 13, palo: 'PICAS' },
      { valor: 12, palo: 'CORAZONES' },
      { valor: 9, palo: 'DIAMANTES' },
      { valor: 7, palo: 'TREBOLES' },
      { valor: 3, palo: 'PICAS' },
    ];
    const manoB: Carta[] = [
      { valor: 13, palo: 'CORAZONES' },
      { valor: 12, palo: 'DIAMANTES' },
      { valor: 9, palo: 'TREBOLES' },
      { valor: 7, palo: 'PICAS' },
      { valor: 3, palo: 'CORAZONES' },
    ];
    const a = clasificarCinco(manoA);
    const b = clasificarCinco(manoB);

    // Verificación de coherencia del caso: misma carta alta y sin Color.
    expect(a.categoria).toBe(b.categoria);
    void valores;

    expect(esEmpateVerdadero(a, b)).toBe(true);
    expect(comparar(a, b)).toBe(0);
  });

  it('caso construido: un par idéntico con kickers iguales en palos distintos es Empate_Verdadero', () => {
    // Par de Ases con kickers K-Q-J; mismos valores, distintos palos en ambas manos.
    const a = clasificarCinco(manoNoColor([14, 14, 13, 12, 11]));
    const b = clasificarCinco([
      { valor: 14, palo: 'DIAMANTES' },
      { valor: 14, palo: 'TREBOLES' },
      { valor: 13, palo: 'CORAZONES' },
      { valor: 12, palo: 'PICAS' },
      { valor: 11, palo: 'DIAMANTES' },
    ]);

    expect(esEmpateVerdadero(a, b)).toBe(true);
    expect(comparar(a, b)).toBe(0);
  });

  it('contraejemplo: manos con distinta carta alta no son Empate_Verdadero', () => {
    // Mismos cuatro valores pero distinta quinta carta: no deben empatar.
    const a = clasificarCinco(manoNoColor([13, 12, 9, 7, 3]));
    const b = clasificarCinco(manoNoColor([14, 12, 9, 7, 3]));

    expect(esEmpateVerdadero(a, b)).toBe(false);
    expect(comparar(a, b)).not.toBe(0);
  });
});
