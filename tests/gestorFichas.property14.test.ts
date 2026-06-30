import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import {
  prepararFichas,
  tomar,
  intercambiarConCentro,
  intercambiarConJugador,
} from '../src/dominio/gestorFichas';
import type { EstadoFichas, Ficha } from '../src/dominio/modelos';

// Prueba basada en propiedades del Gestor_Fichas de The Gang.
// _Requirements: 6.3, 6.4_
//
// Feature: the-gang-game, Property 14: Para cualquier estado de Fichas: (a) un
// intercambio válido del Jugador con una Ficha del centro deja al Jugador en
// posesión de la Ficha del centro y devuelve su Ficha previa al centro; (b) un
// intercambio válido entre dos Jugadores hace que cada uno quede con la Ficha
// que antes tenía el otro. En ambos casos el multiconjunto total de Fichas
// (centro + posesiones) permanece invariante.

/** Clave única para una combinación (color, estrella). */
function clave(ficha: Ficha): string {
  return `${ficha.color}#${ficha.estrellas}`;
}

/**
 * Construye el multiconjunto total de Fichas (centro + todas las posesiones)
 * como un mapa clave->conteo, para comparar invarianza independientemente del
 * orden o de la ubicación de cada Ficha.
 */
function multiconjuntoTotal(estado: EstadoFichas): Map<string, number> {
  const conteo = new Map<string, number>();
  const agregar = (ficha: Ficha): void => {
    const k = clave(ficha);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  };
  estado.centro.forEach(agregar);
  for (const fichas of Object.values(estado.porJugador)) {
    fichas.forEach(agregar);
  }
  return conteo;
}

/** Snapshot inmutable y profundo del estado para detectar mutaciones. */
function instantanea(estado: EstadoFichas): string {
  return JSON.stringify(estado);
}

/** True si el centro contiene una Ficha (color, estrellas) exacta. */
function centroContiene(estado: EstadoFichas, ficha: Ficha): boolean {
  return estado.centro.some(
    (f) => f.color === ficha.color && f.estrellas === ficha.estrellas,
  );
}

/**
 * Genera N (3..6) y dos valores de estrellas distintos `a` y `b` en 1..N.
 * `b` se deriva de `a` con un desplazamiento no nulo módulo N, garantizando
 * a != b y ambos dentro del rango válido.
 */
const genNyDosEstrellas: fc.Arbitrary<{ n: number; a: number; b: number }> = fc
  .integer({ min: 3, max: 6 })
  .chain((n) =>
    fc
      .record({
        a: fc.integer({ min: 1, max: n }),
        offset: fc.integer({ min: 1, max: n - 1 }),
      })
      .map(({ a, offset }) => ({ n, a, b: ((a - 1 + offset) % n) + 1 })),
  );

describe('Property 14: Intercambio de Fichas conserva la cardinalidad y permuta poseedores', () => {
  it('(a) intercambio con el centro: el Jugador queda con la del centro, devuelve la suya y el multiconjunto total es invariante', () => {
    verificarPropiedad(
      fc.property(genNyDosEstrellas, ({ n, a, b }) => {
        // Estado donde j0 ya tomó la Ficha blanca de `a` estrellas; la Ficha
        // blanca de `b` estrellas (b != a) permanece disponible en el centro.
        const base = prepararFichas(n);
        const tras = tomar(base, 'j0', { color: 'BLANCO', estrellas: a });
        expect(tras.ok).toBe(true);
        if (!tras.ok) return;
        const estado = tras.estado;

        const fichaPrevia: Ficha = { color: 'BLANCO', estrellas: a };
        const fichaCentro: Ficha = { color: 'BLANCO', estrellas: b };

        const antes = instantanea(estado);
        const multiAntes = multiconjuntoTotal(estado);

        const res = intercambiarConCentro(estado, 'j0', fichaCentro);
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const nuevo = res.estado;

        // El Jugador queda en posesión de la Ficha del centro y ya no tiene la
        // previa de ese color.
        const blancasJ0 = (nuevo.porJugador['j0'] ?? []).filter(
          (f) => f.color === 'BLANCO',
        );
        expect(blancasJ0).toHaveLength(1);
        expect(blancasJ0[0]).toEqual(fichaCentro);

        // Su Ficha previa vuelve al centro y la tomada ya no está disponible.
        expect(centroContiene(nuevo, fichaPrevia)).toBe(true);
        expect(centroContiene(nuevo, fichaCentro)).toBe(false);

        // El multiconjunto total (centro + posesiones) permanece invariante.
        expect(multiconjuntoTotal(nuevo)).toEqual(multiAntes);

        // No se muta el estado original.
        expect(instantanea(estado)).toBe(antes);
      }),
    );
  });

  it('(b) intercambio entre dos Jugadores: cada uno queda con la del otro y el multiconjunto total es invariante', () => {
    verificarPropiedad(
      fc.property(genNyDosEstrellas, ({ n, a, b }) => {
        // Estado donde j0 tiene la Ficha blanca de `a` estrellas y j1 la de `b`
        // estrellas (a != b), ambas del color activo (BLANCO).
        const base = prepararFichas(n);
        const trasA = tomar(base, 'j0', { color: 'BLANCO', estrellas: a });
        expect(trasA.ok).toBe(true);
        if (!trasA.ok) return;
        const trasB = tomar(trasA.estado, 'j1', { color: 'BLANCO', estrellas: b });
        expect(trasB.ok).toBe(true);
        if (!trasB.ok) return;
        const estado = trasB.estado;

        const fichaA: Ficha = { color: 'BLANCO', estrellas: a };
        const fichaB: Ficha = { color: 'BLANCO', estrellas: b };

        const antes = instantanea(estado);
        const multiAntes = multiconjuntoTotal(estado);

        const res = intercambiarConJugador(estado, 'j0', 'j1', 'BLANCO');
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const nuevo = res.estado;

        // Cada Jugador queda con la Ficha que antes tenía el otro.
        const blancasJ0 = (nuevo.porJugador['j0'] ?? []).filter(
          (f) => f.color === 'BLANCO',
        );
        const blancasJ1 = (nuevo.porJugador['j1'] ?? []).filter(
          (f) => f.color === 'BLANCO',
        );
        expect(blancasJ0).toHaveLength(1);
        expect(blancasJ1).toHaveLength(1);
        expect(blancasJ0[0]).toEqual(fichaB);
        expect(blancasJ1[0]).toEqual(fichaA);

        // El multiconjunto total (centro + posesiones) permanece invariante.
        expect(multiconjuntoTotal(nuevo)).toEqual(multiAntes);

        // No se muta el estado original.
        expect(instantanea(estado)).toBe(antes);
      }),
    );
  });
});
