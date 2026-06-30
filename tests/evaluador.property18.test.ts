import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { type Carta, type Palo, type ManoEvaluada } from '../src/dominio/modelos';
import { construirBaraja } from '../src/dominio/baraja';
import { comparar, clasificarCinco } from '../src/dominio/evaluador';

// Prueba basada en propiedades del comparador del Evaluador_Manos (fast-check + Vitest).
// _Requirements: 7.3_
//
// Feature: the-gang-game, Property 18: Para cualquier par o terna de manos evaluadas, la función de comparación es total y consistente (antisimétrica y transitiva), ordena primero por categoría y luego por los valores de las cartas que la forman seguidos de los kickers en orden descendente, y trata la escalera A-2-3-4-5 como la escalera de menor valor (el As cuenta como 1 únicamente en esa escalera).

/** Baraja completa de 52 cartas distintas, usada para muestrear manos. */
const BARAJA: readonly Carta[] = construirBaraja();

/** Signo de un número: -1, 0 o 1. */
function signo(x: number): number {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}

/**
 * Genera una mano evaluada a partir de 5 cartas distintas tomadas de la baraja.
 * Se eligen 5 índices distintos en 0..51 y se clasifican con `clasificarCinco`,
 * produciendo manos variadas (escaleras, colores, pares, etc.).
 */
const genMano: fc.Arbitrary<ManoEvaluada> = fc
  .uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 5, maxLength: 5 })
  .map((indices) => clasificarCinco(indices.map((i) => BARAJA[i] as Carta)));

/** Construye 5 cartas con palos variados (no Color) a partir de valores dados. */
function manoNoColor(valores: readonly number[]): Carta[] {
  const palos: Palo[] = ['PICAS', 'CORAZONES', 'DIAMANTES', 'TREBOLES', 'PICAS'];
  return valores.map((valor, i) => ({ valor, palo: palos[i] as Palo }));
}

/**
 * Construye una escalera (no Color) por su carta más alta (6..14). Los valores
 * son alta, alta-1, ..., alta-4.
 */
function escaleraPorAlta(alta: number): ManoEvaluada {
  const valores = [alta, alta - 1, alta - 2, alta - 3, alta - 4];
  return clasificarCinco(manoNoColor(valores));
}

/** Construye la escalera más baja, la rueda A-2-3-4-5 (As como 1). */
function ruedaA2345(): ManoEvaluada {
  return clasificarCinco(manoNoColor([14, 2, 3, 4, 5]));
}

describe('Property 18: El comparador es total y consistente con el desempate', () => {
  it('es total: comparar siempre devuelve un número y es reflexivo (comparar(a,a)===0)', () => {
    verificarPropiedad(
      fc.property(genMano, (a) => {
        const r = comparar(a, a);
        expect(typeof r).toBe('number');
        expect(Number.isNaN(r)).toBe(false);
        expect(r).toBe(0);
      }),
    );
  });

  it('es antisimétrico: signo(comparar(a,b)) === -signo(comparar(b,a))', () => {
    verificarPropiedad(
      fc.property(genMano, genMano, (a, b) => {
        expect(signo(comparar(a, b))).toBe(-signo(comparar(b, a)));
      }),
    );
  });

  it('es transitivo sobre ternas: si a<=b y b<=c entonces a<=c (y la igualdad es transitiva)', () => {
    verificarPropiedad(
      fc.property(genMano, genMano, genMano, (a, b, c) => {
        const ab = comparar(a, b);
        const bc = comparar(b, c);
        const ac = comparar(a, c);

        // Transitividad del orden: si a<=b y b<=c entonces a<=c.
        if (ab <= 0 && bc <= 0) {
          expect(ac).toBeLessThanOrEqual(0);
        }
        // Transitividad del orden inverso: si a>=b y b>=c entonces a>=c.
        if (ab >= 0 && bc >= 0) {
          expect(ac).toBeGreaterThanOrEqual(0);
        }
        // Transitividad de la igualdad: si a==b y b==c entonces a==c.
        if (ab === 0 && bc === 0) {
          expect(signo(ac)).toBe(0);
        }
      }),
    );
  });

  it('ordena por categoría y desempate: el orden por comparar coincide con el orden lexicográfico de ranks', () => {
    verificarPropiedad(
      fc.property(genMano, genMano, (a, b) => {
        // El comparador debe ser consistente con el vector de desempate `ranks`,
        // que codifica primero la categoría y luego los valores y kickers
        // en orden descendente.
        const longitud = Math.max(a.ranks.length, b.ranks.length);
        let esperado = 0;
        for (let i = 0; i < longitud; i++) {
          const va = a.ranks[i] ?? 0;
          const vb = b.ranks[i] ?? 0;
          if (va !== vb) {
            esperado = signo(va - vb);
            break;
          }
        }
        expect(signo(comparar(a, b))).toBe(esperado);
      }),
    );
  });

  it('trata la rueda A-2-3-4-5 como la escalera de menor valor', () => {
    const rueda = ruedaA2345();

    // La rueda es estrictamente menor que la escalera 2-3-4-5-6.
    expect(comparar(rueda, escaleraPorAlta(6))).toBeLessThan(0);

    // La rueda es estrictamente menor que cualquier escalera superior (alta 6..14).
    for (let alta = 6; alta <= 14; alta++) {
      expect(comparar(rueda, escaleraPorAlta(alta))).toBeLessThan(0);
      // Y simétricamente, esas escaleras son mayores que la rueda (antisimetría).
      expect(comparar(escaleraPorAlta(alta), rueda)).toBeGreaterThan(0);
    }
  });
});
