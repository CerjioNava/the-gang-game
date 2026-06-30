import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { iniciarPartida, iniciarSiguienteGolpe, MAX_GOLPES } from '../src/dominio/motorJuego';
import type { Jugador, Semilla } from '../src/dominio/modelos';

// Prueba basada en propiedades del Motor_Juego de The Gang (fast-check + Vitest).
// _Requirements: 3.5, 3.6_
//
// Feature: the-gang-game, Property 9: Para cualquier secuencia de Golpes
// resueltos sin que se cumpla una condición de fin de Partida, mientras se hayan
// jugado menos de cinco Golpes el siguiente Golpe inicia en Pre-Flop con número
// incrementado en uno, y en ningún momento el número de Golpes jugados excede
// cinco.

/** Genera el número de Jugadores N: entero entre 3 y 6 (Modo Básico). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/** Genera una semilla para el barajado determinista (número o cadena). */
const genSemilla: fc.Arbitrary<Semilla> = fc.oneof(
  fc.integer(),
  fc.string({ minLength: 1, maxLength: 16 }),
);

/** Construye N Jugadores con ids/nombres deterministas (j0..j{N-1}). */
function crearJugadores(n: number): Jugador[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `j${i}`,
    nombre: `Ladron ${i}`,
    bolsillo: null,
  }));
}

describe('Property 9: Encadenamiento de Golpes acotado a cinco', () => {
  it('encadena Golpes en Pre-Flop con número +1 sin fin de Partida, y nunca supera cinco Golpes jugados', () => {
    verificarPropiedad(
      fc.property(genN, genSemilla, (n, semilla) => {
        // Partida en curso: Golpe 1 en Pre-Flop, sin Bóvedas ni Alarmas.
        // No se modifican bovedasDoradas/alarmasRojas (se mantienen < 3), de
        // modo que nunca se cumple una condición de fin por contadores y el
        // único límite es el máximo de cinco Golpes (criterio 3.6).
        let estado = iniciarPartida(crearJugadores(n), semilla);
        expect(estado.golpesJugados).toBe(0);
        expect(estado.golpeActual!.numero).toBe(1);
        expect(estado.golpeActual!.ronda).toBe('PRE_FLOP');

        // Simula una secuencia de Golpes resueltos encadenando hasta que la
        // Partida finaliza. Se itera con margen por encima de MAX_GOLPES para
        // confirmar que el encadenamiento se detiene exactamente en el límite.
        for (let intento = 0; intento < MAX_GOLPES + 3; intento++) {
          const golpesAntes = estado.golpesJugados;
          const numeroAntes = estado.golpeActual?.numero ?? null;

          estado = iniciarSiguienteGolpe(estado);

          // El número de Golpes jugados se incrementa en uno y nunca excede
          // cinco (criterio 3.6).
          expect(estado.golpesJugados).toBe(golpesAntes + 1);
          expect(estado.golpesJugados).toBeLessThanOrEqual(MAX_GOLPES);

          if (estado.golpesJugados < MAX_GOLPES) {
            // Mientras se hayan jugado menos de cinco Golpes y sin condición de
            // fin, el siguiente Golpe inicia en Pre-Flop con número +1 (3.5).
            expect(estado.fase).toBe('EN_CURSO');
            expect(estado.golpeActual).not.toBeNull();
            expect(estado.golpeActual!.ronda).toBe('PRE_FLOP');
            expect(estado.golpeActual!.numero).toBe((numeroAntes ?? 0) + 1);
            // Coherencia: el número del nuevo Golpe es golpesJugados + 1.
            expect(estado.golpeActual!.numero).toBe(estado.golpesJugados + 1);
          } else {
            // Al alcanzar cinco Golpes la Partida finaliza sin Golpe en curso
            // (criterios 3.6, 3.7).
            expect(estado.fase).toBe('FINALIZADA');
            expect(estado.golpeActual).toBeNull();
            break;
          }
        }

        // La secuencia siempre termina finalizada exactamente en cinco Golpes.
        expect(estado.fase).toBe('FINALIZADA');
        expect(estado.golpesJugados).toBe(MAX_GOLPES);
      }),
    );
  });
});
