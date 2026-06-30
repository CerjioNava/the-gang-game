import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import {
  prepararFichas,
  tomar,
  fichasDisponibles,
} from '../src/dominio/gestorFichas';
import { COLORES_FICHA, type EstadoFichas } from '../src/dominio/modelos';

// Prueba basada en propiedades del Gestor_Fichas de The Gang.
// _Requirements: 5.3, 5.4_
//
// Feature: the-gang-game, Property 11: Para cualquier estado de Fichas
// alcanzable, cada combinación (color, estrella) válida aparece exactamente una
// vez en total entre las Fichas del centro y las Fichas en posesión de los
// Jugadores, las Fichas disponibles de un color distinto al color activo son el
// conjunto vacío, y ningún Jugador posee dos Fichas del mismo color.

/**
 * Una acción de toma generada: el Jugador `jugadorIdx` (0..N-1) intenta tomar
 * la Ficha del color activo con `estrellas` (1..N). Las acciones inválidas
 * (color/estrellas que no corresponden o color duplicado) devuelven ok=false y
 * se ignoran, de modo que solo las tomas válidas modifican el estado.
 */
interface AccionToma {
  jugadorIdx: number;
  estrellas: number;
}

/**
 * Aplica una secuencia de tomas del color activo sobre el estado preparado para
 * N Jugadores, ignorando los resultados ok=false. Devuelve todos los estados
 * alcanzados (incluido el inicial) para poder verificar el invariante sobre
 * cada uno de ellos.
 */
function estadosAlcanzados(
  numJugadores: number,
  acciones: AccionToma[],
): EstadoFichas[] {
  let estado = prepararFichas(numJugadores);
  const estados: EstadoFichas[] = [estado];
  for (const { jugadorIdx, estrellas } of acciones) {
    const jugadorId = `j${jugadorIdx % numJugadores}`;
    const resultado = tomar(estado, jugadorId, {
      color: estado.colorActivo,
      estrellas,
    });
    if (resultado.ok) {
      estado = resultado.estado;
      estados.push(estado);
    }
  }
  return estados;
}

/** Clave única para una combinación (color, estrella). */
function clave(color: string, estrellas: number): string {
  return `${color}#${estrellas}`;
}

describe('Property 11: Invariante de conservación de Fichas', () => {
  it('cada (color,estrella) válida aparece exactamente una vez, los colores no activos no exponen fichas y ningún Jugador duplica color', () => {
    verificarPropiedad(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        fc.array(
          fc.record({
            jugadorIdx: fc.integer({ min: 0, max: 5 }),
            estrellas: fc.integer({ min: 1, max: 6 }),
          }),
          { maxLength: 40 },
        ),
        (numJugadores, acciones) => {
          for (const estado of estadosAlcanzados(numJugadores, acciones)) {
            // (a) Cada combinación (color, estrella) con estrella en 1..N
            // aparece exactamente una vez entre el centro y todas las
            // posesiones de los Jugadores.
            const conteo = new Map<string, number>();
            for (const ficha of estado.centro) {
              const k = clave(ficha.color, ficha.estrellas);
              conteo.set(k, (conteo.get(k) ?? 0) + 1);
            }
            for (const fichas of Object.values(estado.porJugador)) {
              for (const ficha of fichas) {
                const k = clave(ficha.color, ficha.estrellas);
                conteo.set(k, (conteo.get(k) ?? 0) + 1);
              }
            }

            for (const color of COLORES_FICHA) {
              for (let estrellas = 1; estrellas <= numJugadores; estrellas++) {
                expect(conteo.get(clave(color, estrellas))).toBe(1);
              }
            }
            // No existen combinaciones fuera del rango 1..N ni extras: el total
            // de fichas debe ser exactamente 4 colores * N.
            const totalFichas =
              estado.centro.length +
              Object.values(estado.porJugador).reduce(
                (acc, fichas) => acc + fichas.length,
                0,
              );
            expect(totalFichas).toBe(COLORES_FICHA.length * numJugadores);

            // (b) Para todo color distinto del color activo, fichasDisponibles
            // devuelve el conjunto vacío.
            for (const color of COLORES_FICHA) {
              if (color !== estado.colorActivo) {
                expect(fichasDisponibles(estado, color)).toEqual([]);
              }
            }

            // (c) Ningún Jugador posee dos Fichas del mismo color.
            for (const fichas of Object.values(estado.porJugador)) {
              const colores = fichas.map((f) => f.color);
              expect(new Set(colores).size).toBe(colores.length);
            }
          }
        },
      ),
    );
  });
});
