// Barajado determinista y reproducible por semilla (PRNG sembrado).
//
// El barajado es una función pura: dada una baraja y una `Semilla`, produce
// siempre la misma permutación. Esto permite reproducir partidas y escribir
// pruebas deterministas. Se usa el algoritmo de Fisher-Yates con un PRNG
// sembrado por la semilla (number | string).
// _Requirements: 4.1_

import { type Carta, type Semilla } from './modelos';

/**
 * Deriva una semilla entera de 32 bits sin signo a partir de una `Semilla`
 * (número o cadena) usando el hash FNV-1a de 32 bits sobre su representación
 * textual. De este modo cualquier semilla, incluidos números no enteros o
 * cadenas arbitrarias, produce una semilla entera estable para el PRNG.
 */
function derivarSemilla(semilla: Semilla): number {
  const texto = typeof semilla === 'number' ? String(semilla) : semilla;
  let hash = 2166136261 >>> 0; // offset basis FNV-1a (32 bits)
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // prime FNV-1a (32 bits)
  }
  return hash >>> 0;
}

/**
 * PRNG determinista `mulberry32`: a partir de una semilla entera de 32 bits
 * devuelve una función que produce números pseudoaleatorios en el rango
 * [0, 1). Es rápido, sin estado externo y reproducible.
 */
function mulberry32(semillaEntera: number): () => number {
  let estado = semillaEntera >>> 0;
  return function siguiente(): number {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Crea un generador de números pseudoaleatorios determinista a partir de una
 * `Semilla`. Expuesto por si otras partes del dominio necesitan aleatoriedad
 * reproducible sembrada por la misma semilla de la Partida.
 */
export function crearPrng(semilla: Semilla): () => number {
  return mulberry32(derivarSemilla(semilla));
}

/**
 * Baraja una copia de `baraja` de forma determinista usando Fisher-Yates con un
 * PRNG sembrado por `semilla`. No muta la baraja de entrada. Para la misma
 * semilla y la misma baraja de entrada, devuelve siempre la misma permutación.
 */
export function barajar(baraja: readonly Carta[], semilla: Semilla): Carta[] {
  const resultado: Carta[] = baraja.slice();
  const aleatorio = crearPrng(semilla);
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    const temporal = resultado[i]!;
    resultado[i] = resultado[j]!;
    resultado[j] = temporal;
  }
  return resultado;
}
