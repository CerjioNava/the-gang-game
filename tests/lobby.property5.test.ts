import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { registrarJugador } from '../src/dominio/lobby';
import type { Jugador } from '../src/dominio/modelos';

// Prueba basada en propiedades del Lobby de The Gang.
// _Requirements: 2.1_
//
// Feature: the-gang-game, Property 5: Para cualquier nombre válido (cadena no
// vacía, longitud entre 1 y 20, no usada por otro Jugador) y cualquier Partida
// en LOBBY con menos de 6 Jugadores, registrar al Jugador produce una lista que
// contiene exactamente un Jugador adicional con ese nombre.

/**
 * Genera un nombre válido: cadena de 1..20 caracteres que no es solo espacios
 * (criterio 2.1). Se filtran los nombres compuestos únicamente de espacios para
 * mantenerse dentro del espacio de entradas válidas de la propiedad.
 */
const nombreValido: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

describe('Property 5: Registro de Jugador con nombre válido', () => {
  it('registrar un nombre válido en un Lobby con menos de 6 Jugadores añade exactamente un Jugador con ese nombre', () => {
    verificarPropiedad(
      fc.property(
        // Conjunto de nombres únicos: el primero es el nombre nuevo a registrar
        // y el resto (0..5) son los Jugadores ya presentes en el LOBBY. Al ser
        // únicos, el nombre nuevo nunca colisiona con los existentes y la lista
        // inicial tiene menos de 6 Jugadores.
        fc.uniqueArray(nombreValido, { minLength: 1, maxLength: 6 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        (nombres, nuevoId) => {
          const nuevoNombre = nombres[0]!;
          const existentes = nombres.slice(1);

          const jugadores: Jugador[] = existentes.map((nombre, i) => ({
            id: `existente-${i}`,
            nombre,
            bolsillo: null,
          }));

          // Copia para detectar mutaciones de la lista original.
          const snapshotOriginal = jugadores.map((j) => ({ ...j }));

          const resultado = registrarJugador(jugadores, nuevoNombre, nuevoId);

          // El registro debe ser exitoso.
          expect(resultado.ok).toBe(true);
          if (!resultado.ok) return;

          const nueva = resultado.jugadores;

          // La nueva lista tiene exactamente un Jugador más.
          expect(nueva.length).toBe(jugadores.length + 1);

          // Existe exactamente un Jugador adicional con el nombre registrado.
          const conNuevoNombre = nueva.filter((j) => j.nombre === nuevoNombre);
          expect(conNuevoNombre).toHaveLength(1);

          // La lista original no fue mutada (mismo tamaño y mismos elementos).
          expect(jugadores).toHaveLength(snapshotOriginal.length);
          expect(jugadores).toEqual(snapshotOriginal);
        },
      ),
    );
  });
});
