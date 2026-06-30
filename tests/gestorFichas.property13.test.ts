import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { prepararFichas, tomar } from '../src/dominio/gestorFichas';
import type { EstadoFichas, Ficha } from '../src/dominio/modelos';

// Prueba basada en propiedades del Gestor_Fichas de The Gang.
// _Requirements: 6.1_
//
// Feature: the-gang-game, Property 13: Para cualquier estado donde una Ficha del
// color activo está disponible en el centro y el Jugador no posee ya una Ficha
// de ese color, tomar esa Ficha la retira del centro y la añade a la posesión
// del Jugador, conservando el conteo total de Fichas.

/** Genera el número de Jugadores N: entero entre 3 y 6. */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/** Clave única para una combinación (color, estrella). */
function clave(ficha: Ficha): string {
  return `${ficha.color}#${ficha.estrellas}`;
}

/** Cuenta total de Fichas en el estado (centro + todas las posesiones). */
function conteoTotal(estado: EstadoFichas): number {
  return (
    estado.centro.length +
    Object.values(estado.porJugador).reduce((acc, fichas) => acc + fichas.length, 0)
  );
}

/** Multiconjunto de claves (color, estrella) de centro + posesiones. */
function multiconjuntoTotal(estado: EstadoFichas): Map<string, number> {
  const conteo = new Map<string, number>();
  const agregar = (ficha: Ficha) =>
    conteo.set(clave(ficha), (conteo.get(clave(ficha)) ?? 0) + 1);
  estado.centro.forEach(agregar);
  Object.values(estado.porJugador).forEach((fichas) => fichas.forEach(agregar));
  return conteo;
}

describe('Property 13: Toma de Ficha transfiere del centro al Jugador', () => {
  it('tomar una Ficha disponible del color activo la retira del centro, la añade al Jugador y conserva el conteo total', () => {
    verificarPropiedad(
      fc.property(
        genN,
        // Índice del Jugador (0..N-1 tras el módulo) que toma la Ficha.
        fc.integer({ min: 0, max: 5 }),
        // Estrellas de la Ficha del color activo a tomar: 1..N (validado tras conocer N).
        fc.integer({ min: 1, max: 6 }),
        (numJugadores, jugadorIdxBruto, estrellasBrutas) => {
          // El colorActivo inicial es BLANCO y todas las fichas 1..N de ese
          // color están disponibles en el centro tras prepararFichas.
          const estadoInicial = prepararFichas(numJugadores);
          const jugadorId = `j${jugadorIdxBruto % numJugadores}`;
          // Restringir las estrellas al rango disponible 1..N.
          const estrellas = ((estrellasBrutas - 1) % numJugadores) + 1;
          const fichaObjetivo: Ficha = {
            color: estadoInicial.colorActivo,
            estrellas,
          };

          // Precondición: la ficha del color activo está disponible en el centro
          // y el Jugador no posee aún una ficha de ese color (estado recién
          // preparado, sin posesiones).
          const disponibleEnCentro = estadoInicial.centro.some(
            (f) => f.color === fichaObjetivo.color && f.estrellas === fichaObjetivo.estrellas,
          );
          expect(disponibleEnCentro).toBe(true);

          // Capturar invariantes del estado original para detectar mutaciones.
          const centroOriginalSnapshot = JSON.stringify(estadoInicial.centro);
          const porJugadorOriginalSnapshot = JSON.stringify(estadoInicial.porJugador);
          const totalAntes = conteoTotal(estadoInicial);
          const multiAntes = multiconjuntoTotal(estadoInicial);

          const resultado = tomar(estadoInicial, jugadorId, fichaObjetivo);

          // ok = true: la toma de una ficha disponible es válida.
          expect(resultado.ok).toBe(true);
          if (!resultado.ok) return;
          const nuevo = resultado.estado;

          // La ficha ya no está en el centro.
          const sigueEnCentro = nuevo.centro.some(
            (f) => f.color === fichaObjetivo.color && f.estrellas === fichaObjetivo.estrellas,
          );
          expect(sigueEnCentro).toBe(false);

          // El Jugador la tiene ahora en su posesión.
          const enPosesion = (nuevo.porJugador[jugadorId] ?? []).some(
            (f) => f.color === fichaObjetivo.color && f.estrellas === fichaObjetivo.estrellas,
          );
          expect(enPosesion).toBe(true);

          // El conteo total de fichas se conserva (centro + posesiones).
          expect(conteoTotal(nuevo)).toBe(totalAntes);

          // El multiconjunto completo (color, estrella) se conserva: la ficha
          // solo cambió de ubicación, no se creó ni destruyó ninguna.
          const multiDespues = multiconjuntoTotal(nuevo);
          expect(multiDespues).toEqual(multiAntes);

          // El estado original no se mutó.
          expect(JSON.stringify(estadoInicial.centro)).toBe(centroOriginalSnapshot);
          expect(JSON.stringify(estadoInicial.porJugador)).toBe(porJugadorOriginalSnapshot);
        },
      ),
    );
  });
});
