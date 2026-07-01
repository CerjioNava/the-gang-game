import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { aplicarAccion, iniciarPartida } from '../src/dominio/motorJuego';
import type { Ficha, Jugador } from '../src/dominio/modelos';

// Prueba basada en propiedades del Motor_Juego de The Gang (fast-check + Vitest).
// _Requirements: 3.3, 3.4, 6.8_
//
// Feature: the-gang-game, Property 8: Para cualquier estado de Golpe, el
// Motor_Juego habilita el avance (a la siguiente Ronda si no es River, o al
// Showdown si es River) si y solo si todos los Jugadores poseen exactamente una
// Ficha del color de la Ronda activa y todos confirman.

/** Genera el número de Jugadores N: entero entre 3 y 6 (Modo Básico). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/**
 * Genera, para hasta 6 Jugadores, si cada uno toma o no su Ficha del color
 * activo. Se recorta luego a los N Jugadores reales de la Partida.
 */
const genTomas: fc.Arbitrary<boolean[]> = fc.array(fc.boolean(), {
  minLength: 6,
  maxLength: 6,
});

/** Construye N Jugadores con ids/nombres deterministas (j0..j{N-1}). */
function crearJugadores(n: number): Jugador[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `j${i}`,
    nombre: `Jugador ${i}`,
    bolsillo: null,
  }));
}

describe('Property 8: Avance de Ronda condicionado a Fichas completas y confirmación', () => {
  it('CONFIRMAR rechaza al jugador que no tiene ficha del color activo; cuando todos tienen ficha y todos confirman, la ronda avanza', () => {
    verificarPropiedad(
      fc.property(genN, genTomas, fc.integer(), (n, tomasBrutas, semilla) => {
        // Partida en Pre-Flop: el color activo es BLANCO y las Fichas blancas
        // 1..N están disponibles en el centro.
        const jugadores = crearJugadores(n);
        const estadoInicial = iniciarPartida(jugadores, semilla);
        const colorActivo = estadoInicial.golpeActual!.fichas.colorActivo;

        // Subconjunto de Jugadores que toman su Ficha del color activo.
        const tomas = tomasBrutas.slice(0, n);
        let estado = estadoInicial;
        let estrellaSiguiente = 1;
        for (let i = 0; i < n; i++) {
          if (!tomas[i]) continue;
          const ficha: Ficha = { color: colorActivo, estrellas: estrellaSiguiente };
          estrellaSiguiente += 1;
          const res = aplicarAccion(estado, {
            tipo: 'TOMAR_FICHA',
            jugadorId: `j${i}`,
            ficha,
          });
          expect(res.ok).toBe(true);
          if (!res.ok) return;
          estado = res.estado;
        }

        // ¿Todos los Jugadores tomaron su Ficha del color activo?
        const todosTienenFicha = tomas.every((toma) => toma === true);

        const rondaAntes = estado.golpeActual!.ronda;

        if (todosTienenFicha) {
          // Si todos poseen su Ficha, todos pueden confirmar y al confirmar el
          // último la ronda avanza.
          for (let i = 0; i < n - 1; i++) {
            const res = aplicarAccion(estado, { tipo: 'CONFIRMAR', jugadorId: `j${i}` });
            expect(res.ok).toBe(true);
            if (!res.ok) return;
            estado = res.estado;
            // Ronda no ha avanzado aún
            expect(estado.golpeActual!.ronda).toBe(rondaAntes);
          }
          // Último jugador confirma → la ronda avanza
          const resultado = aplicarAccion(estado, { tipo: 'CONFIRMAR', jugadorId: `j${n - 1}` });
          expect(resultado.ok).toBe(true);
          if (!resultado.ok) return;
          expect(resultado.estado.golpeActual!.ronda).toBe('FLOP');
        } else {
          // Si falta al menos un Jugador sin ficha, ese jugador no puede confirmar.
          const sinFicha = tomas.findIndex((toma) => !toma);
          const resultado = aplicarAccion(estado, { tipo: 'CONFIRMAR', jugadorId: `j${sinFicha}` });
          expect(resultado.ok).toBe(false);
          // El estado previo permanece intacto.
          expect(estado.golpeActual!.ronda).toBe(rondaAntes);
        }
      }),
    );
  });
});
