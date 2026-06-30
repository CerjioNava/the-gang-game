import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { iniciarPartida, aplicarAccion, colorDeRonda } from '../src/dominio/motorJuego';
import type { Jugador, Ronda, Semilla } from '../src/dominio/modelos';

// Prueba basada en propiedades del Motor_Juego de The Gang.
// _Requirements: 3.1, 3.2_
//
// Feature: the-gang-game, Property 7: Para cualquier N entre 3 y 6 Jugadores,
// iniciar la Partida produce el Golpe número 1 en la Ronda Pre-Flop, y avanzar
// sucesivamente recorre las Rondas en el orden exacto Pre-Flop → Flop → Turn →
// River → Showdown.

/** Genera el número de Jugadores N: entero entre 3 y 6 (criterio 3.1). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/** Genera una semilla para el barajado determinista (número o cadena). */
const genSemilla: fc.Arbitrary<Semilla> = fc.oneof(
  fc.integer(),
  fc.string({ minLength: 1, maxLength: 16 }),
);

/** Orden esperado de Rondas dentro de un Golpe (criterio 3.2). */
const SECUENCIA_RONDAS: Ronda[] = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

describe('Property 7: Inicio de Partida y secuencia de Rondas', () => {
  it('iniciar produce el Golpe 1 en Pre-Flop y avanzar recorre Pre-Flop → Flop → Turn → River → Showdown', () => {
    verificarPropiedad(
      fc.property(genN, genSemilla, (n, semilla) => {
        // Crea N Jugadores con bolsillo vacío (lo reparte iniciarPartida).
        const jugadores: Jugador[] = Array.from({ length: n }, (_, i) => ({
          id: `jugador-${i}`,
          nombre: `Ladron ${i}`,
          bolsillo: null,
        }));

        // Iniciar la Partida: Golpe número 1 en la Ronda Pre-Flop (criterio 3.1).
        let estado = iniciarPartida(jugadores, semilla);
        expect(estado.golpeActual).not.toBeNull();
        expect(estado.golpeActual!.numero).toBe(1);
        expect(estado.golpeActual!.ronda).toBe('PRE_FLOP');

        // Avanzar sucesivamente recorriendo el orden exacto de Rondas
        // (criterio 3.2). Para habilitar el avance, cada Jugador debe tener una
        // Ficha del color activo; se asigna a cada uno una estrella distinta
        // 1..N del color activo.
        for (let paso = 0; paso < SECUENCIA_RONDAS.length - 1; paso++) {
          const rondaActual = SECUENCIA_RONDAS[paso]!;
          expect(estado.golpeActual!.ronda).toBe(rondaActual);

          const colorActivo = estado.golpeActual!.fichas.colorActivo;
          expect(colorActivo).toBe(colorDeRonda(rondaActual));

          // Cada Jugador toma su Ficha del color activo (estrellas 1..N).
          estado.jugadores.forEach((jugador, indice) => {
            const resultado = aplicarAccion(estado, {
              tipo: 'TOMAR_FICHA',
              jugadorId: jugador.id,
              ficha: { color: colorActivo, estrellas: indice + 1 },
            });
            expect(resultado.ok).toBe(true);
            if (!resultado.ok) return;
            estado = resultado.estado;
          });

          // Con todas las Fichas tomadas, avanzar a la siguiente Ronda.
          const avance = aplicarAccion(estado, { tipo: 'AVANZAR' });
          expect(avance.ok).toBe(true);
          if (!avance.ok) return;
          estado = avance.estado;

          // La Ronda resultante es la siguiente en la secuencia exacta.
          expect(estado.golpeActual!.ronda).toBe(SECUENCIA_RONDAS[paso + 1]);
        }

        // Tras recorrer toda la secuencia, el Golpe está en Showdown.
        expect(estado.golpeActual!.ronda).toBe('SHOWDOWN');
        // El número de Golpe no cambió durante el recorrido de Rondas.
        expect(estado.golpeActual!.numero).toBe(1);
      }),
    );
  });
});
