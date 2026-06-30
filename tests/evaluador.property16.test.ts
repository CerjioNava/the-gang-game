import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { type Carta } from '../src/dominio/modelos';
import { construirBaraja } from '../src/dominio/baraja';
import { evaluar, clasificarCinco, comparar } from '../src/dominio/evaluador';

// Prueba basada en propiedades del Evaluador_Manos (fast-check + Vitest).
// _Requirements: 7.1_

/** Baraja completa de 52 cartas distintas, indexable para muestrear sin repetición. */
const BARAJA: readonly Carta[] = construirBaraja();

/**
 * Genera 7 cartas distintas de la baraja de 52, muestreando 7 índices únicos
 * en el rango 0..51. La unicidad de índices garantiza cartas distintas.
 */
const gen7Cartas: fc.Arbitrary<Carta[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: BARAJA.length - 1 }), {
    minLength: 7,
    maxLength: 7,
  })
  .map((indices) => indices.map((i) => BARAJA[i] as Carta));

/** Genera todas las combinaciones de tamaño `k` de los elementos de `items`. */
function combinaciones<T>(items: readonly T[], k: number): T[][] {
  const resultado: T[][] = [];
  const actual: T[] = [];
  const recurrir = (inicio: number): void => {
    if (actual.length === k) {
      resultado.push([...actual]);
      return;
    }
    for (let i = inicio; i < items.length; i++) {
      actual.push(items[i] as T);
      recurrir(i + 1);
      actual.pop();
    }
  };
  recurrir(0);
  return resultado;
}

describe('Evaluador_Manos (PBT)', () => {
  // Feature: the-gang-game, Property 16: Para cualquier conjunto de 7 cartas distintas (2 de bolsillo + 5 comunitarias), la mano de cinco cartas devuelta por el Evaluador_Manos tiene una fuerza mayor o igual que la de cualquiera de las 21 combinaciones posibles de cinco cartas entre esas siete.
  // Validates: Requirements 7.1
  it('Property 16: elige la mejor combinación de cinco entre siete', () => {
    verificarPropiedad(
      fc.property(gen7Cartas, (siete) => {
        const bolsillo = siete.slice(0, 2) as [Carta, Carta];
        const comunitarias = siete.slice(2, 7);

        const resultado = evaluar(bolsillo, comunitarias);

        // Con 7 cartas válidas y distintas la evaluación siempre tiene éxito.
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) {
          return;
        }

        const manoElegida = resultado.mano;

        // Las C(7,5)=21 combinaciones posibles de cinco cartas entre las siete.
        const combos = combinaciones(siete, 5);
        expect(combos).toHaveLength(21);

        // La mano devuelta es mayor o igual que cualquier combinación de cinco.
        for (const combo of combos) {
          const candidata = clasificarCinco(combo);
          expect(comparar(manoElegida, candidata)).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });
});
