import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { iniciarPartida, aplicarAccion, colorDeRonda } from '../src/dominio/motorJuego';
import { proyectarEstadoPara, BOLSILLO_OCULTO } from '../src/dominio/proyeccion';
import type { Jugador, Ronda, Semilla } from '../src/dominio/modelos';

// Prueba basada en propiedades de la proyección de vistas de The Gang.
// _Requirements: 10.3_
//
// Feature: the-gang-game, Property 3: Para cualquier estado de Partida en fase
// de Showdown, la vista de estado que el Servidor_Local envía a cualquier
// Jugador contiene las Cartas de Bolsillo de todos los Jugadores de la Partida.

/** Genera el número de Jugadores N: entero entre 3 y 6. */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/** Genera una semilla para el barajado determinista (número o cadena). */
const genSemilla: fc.Arbitrary<Semilla> = fc.oneof(
  fc.integer(),
  fc.string({ minLength: 1, maxLength: 16 }),
);

/** Orden de Rondas que se recorren con AVANZAR hasta llegar al Showdown. */
const SECUENCIA_RONDAS: Ronda[] = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'];

describe('Property 3: Revelado de bolsillos en el Showdown', () => {
  it('en SHOWDOWN, la vista de cualquier Jugador contiene las Cartas de Bolsillo de todos los Jugadores', () => {
    verificarPropiedad(
      fc.property(genN, genSemilla, (n, semilla) => {
        // Construir N Jugadores; iniciarPartida reparte las Cartas de Bolsillo.
        const jugadores: Jugador[] = Array.from({ length: n }, (_, i) => ({
          id: `jugador-${i}`,
          nombre: `Ladron ${i}`,
          bolsillo: null,
        }));

        // Llevar la Partida hasta el Showdown: en cada Ronda todos los Jugadores
        // toman su Ficha del color activo (estrellas 1..N) y se aplica AVANZAR.
        let estado = iniciarPartida(jugadores, semilla);
        for (const ronda of SECUENCIA_RONDAS) {
          expect(estado.golpeActual!.ronda).toBe(ronda);
          const colorActivo = estado.golpeActual!.fichas.colorActivo;
          expect(colorActivo).toBe(colorDeRonda(ronda));

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

          const avance = aplicarAccion(estado, { tipo: 'AVANZAR' });
          expect(avance.ok).toBe(true);
          if (!avance.ok) return;
          estado = avance.estado;
        }

        // El Golpe está ahora en SHOWDOWN.
        expect(estado.golpeActual!.ronda).toBe('SHOWDOWN');

        // Para cada Jugador observador, la vista debe contener las Cartas de
        // Bolsillo (las dos cartas reales, no OCULTO) de TODOS los Jugadores.
        for (const observador of estado.jugadores) {
          const vista = proyectarEstadoPara(estado, observador.id);

          // Hay un Jugador visible por cada Jugador de la Partida.
          expect(vista.jugadores).toHaveLength(n);

          for (const jugadorAutoritativo of estado.jugadores) {
            const visible = vista.jugadores.find(
              (j) => j.id === jugadorAutoritativo.id,
            );
            expect(visible).toBeDefined();

            // El bolsillo no está oculto ni nulo: son las dos cartas reales.
            expect(visible!.bolsillo).not.toBe(BOLSILLO_OCULTO);
            expect(visible!.bolsillo).not.toBeNull();

            const bolsilloVisible = visible!.bolsillo as [unknown, unknown];
            expect(bolsilloVisible).toHaveLength(2);

            // Las cartas reveladas coinciden con las Cartas de Bolsillo reales.
            expect(bolsilloVisible).toEqual(jugadorAutoritativo.bolsillo);
          }
        }
      }),
    );
  });
});
