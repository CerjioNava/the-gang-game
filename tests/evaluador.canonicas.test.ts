import { describe, it, expect } from 'vitest';
import {
  evaluar,
  clasificarCinco,
  comparar,
  esEmpateVerdadero,
} from '../src/dominio/evaluador';
import { CategoriaMano, type Carta, type Palo } from '../src/dominio/modelos';

// Pruebas por ejemplo de manos canónicas del Evaluador_Manos (no PBT).
// _Requirements: 7.2, 7.3, 7.4_
//
// Cubren casos concretos con cartas explícitas:
// - Escalera Real (10-J-Q-K-A mismo palo) clasificada como ESCALERA_REAL.
// - Escalera de Color (no terminada en As) como ESCALERA_COLOR.
// - Ranking propio de The Gang: Color vence a Full House y a Póker, y
//   Póker vence a Full House.
// - La rueda A-2-3-4-5 es ESCALERA con carta alta 5 y es menor que 2-3-4-5-6.
// - Empate verdadero: mismas categorías y valores (palos distintos).
// - Desempate por kicker dentro de la misma categoría.

/** Construye una Carta de forma concisa. */
function c(valor: number, palo: Palo): Carta {
  return { valor, palo };
}

describe('Manos canónicas: clasificación de categorías (criterio 7.2)', () => {
  it('clasifica 10-J-Q-K-A del mismo palo como ESCALERA_REAL', () => {
    const escaleraReal: Carta[] = [
      c(10, 'PICAS'),
      c(11, 'PICAS'),
      c(12, 'PICAS'),
      c(13, 'PICAS'),
      c(14, 'PICAS'),
    ];
    expect(clasificarCinco(escaleraReal).categoria).toBe(CategoriaMano.ESCALERA_REAL);
  });

  it('clasifica una escalera de color que no termina en As como ESCALERA_COLOR', () => {
    const escaleraColor: Carta[] = [
      c(9, 'CORAZONES'),
      c(10, 'CORAZONES'),
      c(11, 'CORAZONES'),
      c(12, 'CORAZONES'),
      c(13, 'CORAZONES'),
    ];
    const mano = clasificarCinco(escaleraColor);
    expect(mano.categoria).toBe(CategoriaMano.ESCALERA_COLOR);
    // Carta alta 13 (K), no es Escalera Real.
    expect(mano.ranks).toEqual([CategoriaMano.ESCALERA_COLOR, 13]);
  });

  it('clasifica cinco cartas del mismo palo (no consecutivas) como COLOR', () => {
    const color: Carta[] = [
      c(2, 'DIAMANTES'),
      c(5, 'DIAMANTES'),
      c(7, 'DIAMANTES'),
      c(9, 'DIAMANTES'),
      c(11, 'DIAMANTES'),
    ];
    expect(clasificarCinco(color).categoria).toBe(CategoriaMano.COLOR);
  });

  it('clasifica tres iguales más una pareja como FULL_HOUSE', () => {
    const fullHouse: Carta[] = [
      c(13, 'PICAS'),
      c(13, 'CORAZONES'),
      c(13, 'DIAMANTES'),
      c(12, 'TREBOLES'),
      c(12, 'PICAS'),
    ];
    expect(clasificarCinco(fullHouse).categoria).toBe(CategoriaMano.FULL_HOUSE);
  });

  it('clasifica cuatro iguales como POKER', () => {
    const poker: Carta[] = [
      c(14, 'PICAS'),
      c(14, 'CORAZONES'),
      c(14, 'DIAMANTES'),
      c(14, 'TREBOLES'),
      c(13, 'PICAS'),
    ];
    expect(clasificarCinco(poker).categoria).toBe(CategoriaMano.POKER);
  });
});

describe('Ranking propio de The Gang: Color > Póker > Full House (criterios 7.2, 7.3)', () => {
  // En The Gang el orden es Full House < Póker < Color, a diferencia del póker tradicional.
  const fullHouse = clasificarCinco([
    c(13, 'PICAS'),
    c(13, 'CORAZONES'),
    c(13, 'DIAMANTES'),
    c(12, 'TREBOLES'),
    c(12, 'PICAS'),
  ]);
  const poker = clasificarCinco([
    c(14, 'PICAS'),
    c(14, 'CORAZONES'),
    c(14, 'DIAMANTES'),
    c(14, 'TREBOLES'),
    c(13, 'PICAS'),
  ]);
  const color = clasificarCinco([
    c(2, 'DIAMANTES'),
    c(5, 'DIAMANTES'),
    c(7, 'DIAMANTES'),
    c(9, 'DIAMANTES'),
    c(11, 'DIAMANTES'),
  ]);

  it('un Color vence a un Full House', () => {
    expect(comparar(color, fullHouse)).toBeGreaterThan(0);
  });

  it('un Color vence a un Póker', () => {
    expect(comparar(color, poker)).toBeGreaterThan(0);
  });

  it('un Póker vence a un Full House', () => {
    expect(comparar(poker, fullHouse)).toBeGreaterThan(0);
  });
});

describe('La rueda A-2-3-4-5 (criterio 7.3)', () => {
  const rueda = clasificarCinco([
    c(14, 'PICAS'),
    c(2, 'CORAZONES'),
    c(3, 'DIAMANTES'),
    c(4, 'TREBOLES'),
    c(5, 'PICAS'),
  ]);
  const escalera23456 = clasificarCinco([
    c(2, 'PICAS'),
    c(3, 'CORAZONES'),
    c(4, 'DIAMANTES'),
    c(5, 'TREBOLES'),
    c(6, 'PICAS'),
  ]);

  it('es una ESCALERA con carta alta 5 (el As cuenta como 1)', () => {
    expect(rueda.categoria).toBe(CategoriaMano.ESCALERA);
    expect(rueda.ranks).toEqual([CategoriaMano.ESCALERA, 5]);
  });

  it('es menor que la escalera 2-3-4-5-6', () => {
    expect(comparar(rueda, escalera23456)).toBeLessThan(0);
    expect(comparar(escalera23456, rueda)).toBeGreaterThan(0);
  });
});

describe('Empate verdadero (criterio 7.4)', () => {
  it('dos manos con los mismos valores y palos distintos (sin color) empatan', () => {
    // Dos pares idénticos en valores: K-K-7-7-2, pero con palos distintos.
    const manoA = clasificarCinco([
      c(13, 'PICAS'),
      c(13, 'CORAZONES'),
      c(7, 'DIAMANTES'),
      c(7, 'TREBOLES'),
      c(2, 'PICAS'),
    ]);
    const manoB = clasificarCinco([
      c(13, 'DIAMANTES'),
      c(13, 'TREBOLES'),
      c(7, 'PICAS'),
      c(7, 'CORAZONES'),
      c(2, 'CORAZONES'),
    ]);

    expect(esEmpateVerdadero(manoA, manoB)).toBe(true);
    expect(comparar(manoA, manoB)).toBe(0);
  });

  it('el empate verdadero también se observa evaluando 7 cartas distintas', () => {
    // Ambos jugadores forman la misma mejor mano usando las comunitarias.
    const comunitarias: Carta[] = [
      c(13, 'PICAS'),
      c(13, 'CORAZONES'),
      c(7, 'DIAMANTES'),
      c(7, 'TREBOLES'),
      c(2, 'PICAS'),
    ];
    const a = evaluar([c(3, 'PICAS'), c(4, 'CORAZONES')], comunitarias);
    const b = evaluar([c(3, 'DIAMANTES'), c(4, 'TREBOLES')], comunitarias);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(esEmpateVerdadero(a.mano, b.mano)).toBe(true);
    expect(comparar(a.mano, b.mano)).toBe(0);
  });
});

describe('Desempate por kicker dentro de la misma categoría (criterio 7.3)', () => {
  it('dos parejas de Ases se desempatan por los kickers descendentes', () => {
    const parAltoKicker: Carta[] = [
      c(14, 'PICAS'),
      c(14, 'CORAZONES'),
      c(13, 'DIAMANTES'),
      c(12, 'TREBOLES'),
      c(11, 'PICAS'), // kicker J
    ];
    const parBajoKicker: Carta[] = [
      c(14, 'DIAMANTES'),
      c(14, 'TREBOLES'),
      c(13, 'PICAS'),
      c(12, 'CORAZONES'),
      c(9, 'DIAMANTES'), // kicker 9
    ];
    const manoA = clasificarCinco(parAltoKicker);
    const manoB = clasificarCinco(parBajoKicker);

    // Ambas son PAR de Ases con kickers K, Q y difieren solo en el último kicker.
    expect(manoA.categoria).toBe(CategoriaMano.PAR);
    expect(manoB.categoria).toBe(CategoriaMano.PAR);
    expect(comparar(manoA, manoB)).toBeGreaterThan(0);
    expect(comparar(manoB, manoA)).toBeLessThan(0);
    expect(esEmpateVerdadero(manoA, manoB)).toBe(false);
  });
});
