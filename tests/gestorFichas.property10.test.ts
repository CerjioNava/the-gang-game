import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { prepararFichas } from '../src/dominio/gestorFichas';
import { COLORES_FICHA } from '../src/dominio/modelos';

// Prueba basada en propiedades del Gestor_Fichas de The Gang.
// _Requirements: 5.1, 5.2_
//
// Feature: the-gang-game, Property 10: Para cualquier N entre 3 y 6, preparar
// las Fichas no produce ninguna Ficha con valor de estrellas superior a N en
// ninguno de los cuatro colores, y existe exactamente una Ficha por cada valor
// de estrellas entre 1 y N para cada color.

/** Genera el número de Jugadores N: entero entre 3 y 6 (criterio 5.1). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

describe('Property 10: Preparación de Fichas según el número de Jugadores', () => {
  it('para N entre 3 y 6, el centro tiene exactamente una Ficha por valor 1..N en cada color y ninguna con estrellas > N', () => {
    verificarPropiedad(
      fc.property(genN, (n) => {
        const estado = prepararFichas(n);

        // El número de Jugadores queda registrado y no hay posesiones aún.
        expect(estado.numJugadores).toBe(n);
        expect(Object.keys(estado.porJugador)).toHaveLength(0);

        // Ninguna Ficha del centro tiene estrellas > N (criterio 5.1).
        for (const ficha of estado.centro) {
          expect(ficha.estrellas).toBeLessThanOrEqual(n);
          expect(ficha.estrellas).toBeGreaterThanOrEqual(1);
        }

        // En total hay exactamente 4 * N Fichas en el centro.
        expect(estado.centro).toHaveLength(COLORES_FICHA.length * n);

        // Para cada uno de los cuatro colores existe exactamente una Ficha por
        // cada valor de estrellas entre 1 y N (criterios 5.1, 5.2).
        for (const color of COLORES_FICHA) {
          const delColor = estado.centro.filter((f) => f.color === color);
          const estrellas = delColor.map((f) => f.estrellas).sort((a, b) => a - b);
          const esperadas = Array.from({ length: n }, (_, i) => i + 1);
          expect(estrellas).toEqual(esperadas);
        }
      }),
    );
  });
});
