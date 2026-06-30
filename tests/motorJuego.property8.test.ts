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
// Ficha del color de la Ronda activa.

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

describe('Property 8: Avance de Ronda condicionado a Fichas completas', () => {
  it('AVANZAR tiene ok=true (y avanza la Ronda) si y solo si todos los Jugadores poseen una Ficha del color activo', () => {
    verificarPropiedad(
      fc.property(genN, genTomas, fc.integer(), (n, tomasBrutas, semilla) => {
        // Partida en Pre-Flop: el color activo es BLANCO y las Fichas blancas
        // 1..N están disponibles en el centro.
        const jugadores = crearJugadores(n);
        const estadoInicial = iniciarPartida(jugadores, semilla);
        const colorActivo = estadoInicial.golpeActual!.fichas.colorActivo;

        // Subconjunto de Jugadores que toman su Ficha del color activo. A cada
        // tomador se le asigna una estrella distinta (1, 2, 3, ...) para que la
        // toma sea siempre válida y no haya colisiones de Ficha en el centro.
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
          // Cada toma de una Ficha disponible y distinta debe ser válida.
          expect(res.ok).toBe(true);
          if (!res.ok) return;
          estado = res.estado;
        }

        // ¿Todos los Jugadores tomaron su Ficha del color activo?
        const todosTienenFicha = tomas.every((toma) => toma === true);

        const rondaAntes = estado.golpeActual!.ronda;
        const resultado = aplicarAccion(estado, { tipo: 'AVANZAR' });

        if (todosTienenFicha) {
          // Bicondicional (⇒): si todos poseen su Ficha, el avance se habilita.
          expect(resultado.ok).toBe(true);
          if (!resultado.ok) return;
          // Desde Pre-Flop el avance pasa a la siguiente Ronda (Flop).
          expect(resultado.estado.golpeActual!.ronda).toBe('FLOP');
        } else {
          // Bicondicional (⇐): si falta al menos un Jugador, el avance se
          // rechaza y la Ronda no cambia.
          expect(resultado.ok).toBe(false);
          // El estado previo permanece intacto: la Ronda sigue siendo la misma.
          expect(estado.golpeActual!.ronda).toBe(rondaAntes);
        }
      }),
    );
  });
});
