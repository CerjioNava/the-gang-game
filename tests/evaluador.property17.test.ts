import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { CategoriaMano, type Carta, type Palo } from '../src/dominio/modelos';
import { evaluar } from '../src/dominio/evaluador';

// Prueba basada en propiedades model-based del Evaluador_Manos (fast-check + Vitest).
//
// Esta prueba implementa un evaluador de REFERENCIA independiente y sencillo
// (un oráculo) que NO reutiliza la lógica de clasificación de producción
// (`src/dominio/evaluador.ts`). El oráculo recibe 7 cartas, evalúa las 21
// combinaciones de 5 cartas con una clasificación escrita de forma autónoma y
// determina la mejor categoría según el orden de The Gang. La propiedad verifica
// que la categoría que asigna `evaluar()` coincide con la del oráculo.
//
// _Requirements: 7.2_

// ===========================================================================
// Baraja completa de 52 cartas (solo construcción de datos, sin clasificación)
// ===========================================================================

const PALOS_REF: readonly Palo[] = ['PICAS', 'CORAZONES', 'DIAMANTES', 'TREBOLES'];

const BARAJA_REF: readonly Carta[] = (() => {
  const cartas: Carta[] = [];
  for (let valor = 2; valor <= 14; valor++) {
    for (const palo of PALOS_REF) {
      cartas.push({ valor, palo });
    }
  }
  return cartas;
})();

// ===========================================================================
// Oráculo de referencia: clasificación independiente de 5 cartas
// ===========================================================================

/** Mapa de frecuencias valor -> número de apariciones entre las 5 cartas. */
function conteoValoresRef(cartas: readonly Carta[]): Map<number, number> {
  const conteo = new Map<number, number>();
  for (const c of cartas) {
    conteo.set(c.valor, (conteo.get(c.valor) ?? 0) + 1);
  }
  return conteo;
}

/** Todas las cartas comparten palo (Color). */
function esColorRef(cartas: readonly Carta[]): boolean {
  const palo = cartas[0]?.palo;
  return cartas.every((c) => c.palo === palo);
}

/**
 * Detecta escalera entre 5 cartas, devolviendo la carta alta. La rueda
 * A-2-3-4-5 cuenta con carta alta 5 (el As vale 1 únicamente en ese caso).
 */
function escaleraRef(cartas: readonly Carta[]): { esEscalera: boolean; cartaAlta: number } {
  const unicos = [...new Set(cartas.map((c) => c.valor))].sort((a, b) => a - b);
  if (unicos.length !== 5) {
    return { esEscalera: false, cartaAlta: 0 };
  }
  const min = unicos[0] as number;
  const max = unicos[4] as number;
  if (max - min === 4) {
    return { esEscalera: true, cartaAlta: max };
  }
  // Rueda: 2,3,4,5,As(14).
  if (unicos[0] === 2 && unicos[1] === 3 && unicos[2] === 4 && unicos[3] === 5 && unicos[4] === 14) {
    return { esEscalera: true, cartaAlta: 5 };
  }
  return { esEscalera: false, cartaAlta: 0 };
}

/**
 * Clasifica 5 cartas en una categoría del Ranking_de_Manos según el orden de
 * The Gang. Implementación independiente del evaluador de producción.
 */
function clasificarCincoRef(cartas: readonly Carta[]): CategoriaMano {
  const color = esColorRef(cartas);
  const { esEscalera, cartaAlta } = escaleraRef(cartas);
  const frecuencias = [...conteoValoresRef(cartas).values()].sort((a, b) => b - a);
  const max = frecuencias[0] ?? 0;
  const segunda = frecuencias[1] ?? 0;

  if (esEscalera && color) {
    return cartaAlta === 14 ? CategoriaMano.ESCALERA_REAL : CategoriaMano.ESCALERA_COLOR;
  }
  if (max === 4) {
    return CategoriaMano.POKER;
  }
  if (max === 3 && segunda === 2) {
    return CategoriaMano.FULL_HOUSE;
  }
  if (color) {
    return CategoriaMano.COLOR;
  }
  if (esEscalera) {
    return CategoriaMano.ESCALERA;
  }
  if (max === 3) {
    return CategoriaMano.TRIO;
  }
  if (max === 2 && segunda === 2) {
    return CategoriaMano.DOS_PARES;
  }
  if (max === 2) {
    return CategoriaMano.PAR;
  }
  return CategoriaMano.CARTA_ALTA;
}

/** Genera todas las combinaciones de tamaño `k` de los elementos de `items`. */
function combinacionesRef<T>(items: readonly T[], k: number): T[][] {
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

/**
 * Oráculo: mejor categoría entre las 21 combinaciones de 5 cartas de las 7
 * disponibles. El orden de The Gang está codificado en los valores numéricos
 * del enum (Full House < Póker < Color), por lo que la mejor categoría es el
 * máximo numérico.
 */
function mejorCategoriaRef(siete: readonly Carta[]): CategoriaMano {
  let mejor = CategoriaMano.CARTA_ALTA;
  for (const combo of combinacionesRef(siete, 5)) {
    const categoria = clasificarCincoRef(combo);
    if (categoria > mejor) {
      mejor = categoria;
    }
  }
  return mejor;
}

// ===========================================================================
// Generador de 7 cartas distintas
// ===========================================================================

/** 7 cartas distintas tomadas de la baraja de 52. */
const gen7Cartas = fc
  .uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 7, maxLength: 7 })
  .map((indices) => indices.map((i) => BARAJA_REF[i] as Carta));

// ===========================================================================
// Property 17
// ===========================================================================

describe('Evaluador_Manos clasificación de categoría (PBT model-based)', () => {
  // Feature: the-gang-game, Property 17: Para cualquier conjunto de 7 cartas distintas, la categoría del Ranking_de_Manos asignada por el Evaluador_Manos coincide con la categoría determinada por un evaluador de referencia independiente y sencillo.
  // Validates: Requirements 7.2
  it('Property 17: la categoría coincide con la del oráculo de referencia', () => {
    verificarPropiedad(
      fc.property(gen7Cartas, (siete) => {
        const bolsillo: [Carta, Carta] = [siete[0] as Carta, siete[1] as Carta];
        const comunitarias = siete.slice(2);

        const resultado = evaluar(bolsillo, comunitarias);
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) {
          return;
        }

        const categoriaOraculo = mejorCategoriaRef(siete);
        expect(resultado.mano.categoria).toBe(categoriaOraculo);
      }),
    );
  });
});
