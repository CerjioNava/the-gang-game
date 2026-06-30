import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { type Carta } from '../src/dominio/modelos';
import { construirBaraja } from '../src/dominio/baraja';
import { evaluar } from '../src/dominio/evaluador';

// Prueba basada en propiedades del Evaluador_Manos (fast-check + Vitest).
// _Requirements: 7.5_

/** Baraja completa de 52 cartas distintas, indexable para muestrear sin repetición. */
const BARAJA: readonly Carta[] = construirBaraja();

/**
 * Genera `n` cartas distintas de la baraja de 52 (sin repetición). Permite
 * `n = 0` para producir un arreglo vacío.
 */
function genCartas(n: number): fc.Arbitrary<Carta[]> {
  if (n === 0) {
    return fc.constant<Carta[]>([]);
  }
  return fc
    .uniqueArray(fc.integer({ min: 0, max: BARAJA.length - 1 }), {
      minLength: n,
      maxLength: n,
    })
    .map((indices) => indices.map((i) => BARAJA[i] as Carta));
}

/**
 * Genera un valor para `bolsillo` que es inválido por sí mismo (length != 2) o
 * que combinado con `comunitarias` produce una entrada inválida.
 *
 * Cubre: null, undefined, 0/1 cartas, más de 2 cartas (3 o 4), y también el
 * caso válido de 2 cartas (que solo será inválido si las comunitarias lo son).
 */
const genBolsillo: fc.Arbitrary<Carta[] | null | undefined> = fc.oneof(
  fc.constant<null>(null),
  fc.constant<undefined>(undefined),
  fc.nat({ max: 4 }).chain((n) => genCartas(n)),
);

/**
 * Genera un valor para `comunitarias`: null, undefined, o un arreglo de 0..7
 * cartas (inválido cuando length != 5; el caso de 5 solo es inválido si el
 * bolsillo lo es).
 */
const genComunitarias: fc.Arbitrary<Carta[] | null | undefined> = fc.oneof(
  fc.constant<null>(null),
  fc.constant<undefined>(undefined),
  fc.nat({ max: 7 }).chain((n) => genCartas(n)),
);

/** Indica si la entrada representa un par válido (2 de bolsillo + 5 comunitarias). */
function esEntradaValida(
  bolsillo: Carta[] | null | undefined,
  comunitarias: Carta[] | null | undefined,
): boolean {
  return (
    Array.isArray(bolsillo) &&
    bolsillo.length === 2 &&
    Array.isArray(comunitarias) &&
    comunitarias.length === 5
  );
}

describe('Evaluador_Manos (PBT)', () => {
  // Feature: the-gang-game, Property 20: Para cualquier entrada en la que falten Cartas de Bolsillo o no estén disponibles las cinco Cartas Comunitarias, el Evaluador_Manos no produce clasificación y devuelve un error de cartas insuficientes.
  // Validates: Requirements 7.5
  it('Property 20: evaluación con cartas insuficientes produce error', () => {
    const genEntradaInvalida = fc
      .tuple(genBolsillo, genComunitarias)
      // Descartamos las entradas que SÍ son válidas (2 bolsillo + 5 comunitarias);
      // la propiedad cubre exclusivamente entradas con cartas insuficientes.
      .filter(([bolsillo, comunitarias]) => !esEntradaValida(bolsillo, comunitarias));

    verificarPropiedad(
      fc.property(genEntradaInvalida, ([bolsillo, comunitarias]) => {
        const resultado = evaluar(bolsillo, comunitarias);

        // No produce clasificación: devuelve ok=false con el motivo esperado.
        expect(resultado.ok).toBe(false);
        if (resultado.ok) {
          return;
        }
        expect(resultado.motivo).toBe('CARTAS_INSUFICIENTES');
        // No se produce ninguna mano cuando faltan cartas.
        expect('mano' in resultado).toBe(false);
      }),
    );
  });
});
