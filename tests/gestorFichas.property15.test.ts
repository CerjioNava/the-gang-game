import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import {
  prepararFichas,
  tomar,
  intercambiarConCentro,
} from '../src/dominio/gestorFichas';
import { type EstadoFichas, type Ficha } from '../src/dominio/modelos';

// Prueba basada en propiedades del Gestor_Fichas de The Gang.
// _Requirements: 6.7_
//
// Feature: the-gang-game, Property 15: Para cualquier estado y cualquier acción
// que no sea un intercambio válido conforme a las reglas, el conjunto de Fichas
// en posesión de cualquier Jugador distinto del que actúa no aumenta.

/**
 * Una toma generada: el Jugador `jugadorIdx` (módulo N) intenta tomar la Ficha
 * del color activo con `estrellas`. Sirve para variar el estado de partida
 * mediante tomas válidas (las inválidas se ignoran, conservando el estado).
 */
interface AccionToma {
  jugadorIdx: number;
  estrellas: number;
}

/**
 * Construye un estado de Fichas variado: prepara para N Jugadores y aplica una
 * secuencia de tomas del color activo, descartando las que resultan inválidas.
 */
function estadoVariado(
  numJugadores: number,
  acciones: AccionToma[],
): EstadoFichas {
  let estado = prepararFichas(numJugadores);
  for (const { jugadorIdx, estrellas } of acciones) {
    const jugadorId = `j${jugadorIdx % numJugadores}`;
    const resultado = tomar(estado, jugadorId, {
      color: estado.colorActivo,
      estrellas,
    });
    if (resultado.ok) {
      estado = resultado.estado;
    }
  }
  return estado;
}

/** Multiconjunto de claves (color#estrellas) de las Fichas de un Jugador. */
function clavesDe(estado: EstadoFichas, jugadorId: string): string[] {
  return (estado.porJugador[jugadorId] ?? [])
    .map((f: Ficha) => `${f.color}#${f.estrellas}`)
    .sort();
}

/** Identificadores de todos los Jugadores de una Partida de N. */
function jugadores(numJugadores: number): string[] {
  return Array.from({ length: numJugadores }, (_, i) => `j${i}`);
}

describe('Property 15: Las Fichas no se transfieren a otro Jugador salvo por intercambio', () => {
  it('al actuar (tomar/intercambiarConCentro) un Jugador, ningún otro Jugador ve aumentar sus Fichas, tanto si la acción tuvo éxito como si fue rechazada', () => {
    verificarPropiedad(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        fc.array(
          fc.record({
            jugadorIdx: fc.integer({ min: 0, max: 5 }),
            estrellas: fc.integer({ min: 1, max: 6 }),
          }),
          { maxLength: 30 },
        ),
        fc.integer({ min: 0, max: 5 }),
        fc.constantFrom<'tomar' | 'intercambiar'>('tomar', 'intercambiar'),
        fc.integer({ min: 1, max: 6 }),
        (numJugadores, tomasPrevias, actorIdx, tipoAccion, estrellas) => {
          const estado = estadoVariado(numJugadores, tomasPrevias);
          const actor = `j${actorIdx % numJugadores}`;
          const otros = jugadores(numJugadores).filter((id) => id !== actor);

          // Conjunto de Fichas de cada otro Jugador ANTES de que actúe el actor.
          const antes = new Map<string, string[]>();
          for (const id of otros) {
            antes.set(id, clavesDe(estado, id));
          }

          const ficha: Ficha = { color: estado.colorActivo, estrellas };
          const resultado =
            tipoAccion === 'tomar'
              ? tomar(estado, actor, ficha)
              : intercambiarConCentro(estado, actor, ficha);

          // El estado resultante es el nuevo si la acción tuvo éxito; si fue
          // rechazada, el estado original permanece intacto.
          const estadoResultante = resultado.ok ? resultado.estado : estado;

          for (const id of otros) {
            const despues = clavesDe(estadoResultante, id);
            const previas = antes.get(id)!;

            // El conjunto de Fichas del otro Jugador no aumenta: ni en tamaño
            // ni adquiere ninguna Ficha que no tuviera antes. De hecho, ninguna
            // de estas acciones afecta a otros Jugadores, por lo que su
            // contenido permanece idéntico.
            expect(despues.length).toBeLessThanOrEqual(previas.length);
            expect(despues).toEqual(previas);
          }
        },
      ),
    );
  });
});
