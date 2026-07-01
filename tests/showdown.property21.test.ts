import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { resolverShowdown } from '../src/dominio/showdown';
import {
  PALOS,
  type Carta,
  type EstadoGolpe,
  type Ficha,
  type Jugador,
} from '../src/dominio/modelos';

// Prueba basada en propiedades de la resolución del Showdown de The Gang.
// _Requirements: 8.1, 8.2_
//
// Feature: the-gang-game, Property 21: Para cualquier asignación de Fichas rojas
// a los Jugadores (una permutación de los valores 1 a N), el orden del Showdown
// contiene exactamente N posiciones, es estrictamente ascendente por valor de
// estrellas de la Ficha roja, y asigna a cada Jugador exactamente una posición.

/** Número de Jugadores N: entero entre 3 y 6 (criterio 8.1). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/**
 * Baraja completa de 52 cartas distintas, usada como reserva para construir
 * Cartas de Bolsillo y Comunitarias sin repetición. El contenido concreto de
 * las cartas es irrelevante para Property 21 (solo se exige que cada Jugador
 * tenga una mano evaluable de 2 bolsillo + 5 comunitarias).
 */
const BARAJA: Carta[] = PALOS.flatMap((palo) =>
  Array.from({ length: 13 }, (_, i) => ({ valor: i + 2, palo })),
);

/**
 * Genera N junto con una permutación de los valores 1..N para las Fichas rojas.
 * `fc.shuffledSubarray` con longitud fija igual a N produce una permutación
 * completa y aleatoria del arreglo [1, 2, ..., N].
 */
const genNyPermutacionRojas: fc.Arbitrary<{ n: number; permutacion: number[] }> =
  genN.chain((n) => {
    const valores = Array.from({ length: n }, (_, i) => i + 1);
    return fc
      .shuffledSubarray(valores, { minLength: n, maxLength: n })
      .map((permutacion) => ({ n, permutacion }));
  });

describe('Property 21: Orden del Showdown es una biyección ascendente', () => {
  it('para cualquier permutación de Fichas rojas 1..N, el orden tiene N posiciones, es estrictamente ascendente y es una biyección sobre los Jugadores', () => {
    verificarPropiedad(
      fc.property(genNyPermutacionRojas, ({ n, permutacion }) => {
        // Construir N Jugadores, cada uno con 2 Cartas de Bolsillo distintas
        // tomadas de la baraja, y 5 Cartas Comunitarias también distintas.
        // Se reservan las primeras 5 cartas como comunitarias y luego 2 por
        // Jugador, de modo que todas las cartas en juego son distintas.
        const comunitarias = BARAJA.slice(0, 5);
        const jugadores: Jugador[] = Array.from({ length: n }, (_, i) => {
          const offset = 5 + i * 2;
          const bolsillo: [Carta, Carta] = [
            BARAJA[offset]!,
            BARAJA[offset + 1]!,
          ];
          return { id: `jugador-${i}`, nombre: `Ladron ${i}`, bolsillo };
        });

        // Asignar a cada Jugador exactamente una Ficha roja según la permutación
        // de valores 1..N (cada valor de estrella se usa exactamente una vez).
        const porJugador: Record<string, Ficha[]> = {};
        jugadores.forEach((jugador, i) => {
          porJugador[jugador.id] = [{ color: 'ROJO', estrellas: permutacion[i]! }];
        });

        const golpe: EstadoGolpe = {
          numero: 1,
          ronda: 'SHOWDOWN',
          baraja: [],
          comunitarias,
          fichas: {
            numJugadores: n,
            centro: [],
            porJugador,
            colorActivo: 'ROJO',
          },
          confirmados: [],
        };

        const resultado = resolverShowdown(jugadores, golpe);

        // (1) El orden contiene exactamente N posiciones.
        expect(resultado.orden).toHaveLength(n);

        // (2) Estrictamente ascendente por valor de estrellas de la Ficha roja.
        for (let i = 0; i + 1 < resultado.orden.length; i++) {
          expect(resultado.orden[i]!.estrellasRojas).toBeLessThan(
            resultado.orden[i + 1]!.estrellasRojas,
          );
        }

        // (3) Biyección: cada Jugador aparece exactamente una vez en el orden.
        const idsEnOrden = resultado.orden.map((p) => p.jugadorId).sort();
        const idsEsperados = jugadores.map((j) => j.id).sort();
        expect(idsEnOrden).toEqual(idsEsperados);
        expect(new Set(idsEnOrden).size).toBe(n);

        // Las estrellas rojas del orden son exactamente la permutación de 1..N,
        // ya ordenada de forma ascendente (1, 2, ..., N).
        const estrellasEnOrden = resultado.orden.map((p) => p.estrellasRojas);
        expect(estrellasEnOrden).toEqual(
          Array.from({ length: n }, (_, i) => i + 1),
        );
      }),
    );
  });
});
