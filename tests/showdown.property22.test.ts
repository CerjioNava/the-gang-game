import { describe, it, expect } from "vitest";
import { fc, verificarPropiedad } from "./pbt";
import type {
  Carta,
  EstadoGolpe,
  Ficha,
  Jugador,
} from "../src/dominio/modelos";
import {
  crearBarajaBarajada,
  repartirBolsillos,
  revelarFlop,
  revelarTurn,
  revelarRiver,
} from "../src/dominio/reparto";
import { resolverShowdown } from "../src/dominio/showdown";
import { comparar, evaluar } from "../src/dominio/evaluador";

// Prueba basada en propiedades de la resolución del Showdown (fast-check + Vitest).
// _Requirements: 8.3, 8.4_

/** Generador de semillas arbitrarias para barajar de forma determinista. */
const genSemilla = fc.oneof(
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.string(),
);

/** Número de Jugadores N entre 3 y 6 (Modo Básico). */
const genN = fc.integer({ min: 3, max: 6 });

/**
 * Genera un caso de Showdown: N Jugadores con bolsillos y 5 comunitarias
 * extraídos de una baraja barajada (sin repetición), y una asignación de Fichas
 * rojas que es una permutación de los valores 1..N (en golpe.fichas.porJugador).
 *
 * La permutación se construye ordenando índices por claves aleatorias, lo que
 * garantiza que `estrellasRojas` reciba exactamente los valores 1..N, cada uno
 * una sola vez.
 */
const genCaso = genN.chain((n) =>
  fc
    .record({
      semilla: genSemilla,
      claves: fc.array(fc.double({ noNaN: true }), {
        minLength: n,
        maxLength: n,
      }),
    })
    .map(({ semilla, claves }) => {
      // Permutación de 1..N: ordena índices por su clave aleatoria y asigna la
      // posición (1..N) resultante a cada Jugador.
      const indices = claves
        .map((clave, i) => ({ clave, i }))
        .sort((a, b) => a.clave - b.clave)
        .map((x) => x.i);
      const estrellas: number[] = new Array(n);
      indices.forEach((origIdx, pos) => {
        estrellas[origIdx] = pos + 1;
      });
      return { n, semilla, estrellas };
    }),
);

/**
 * Construye un estado de Golpe en fase SHOWDOWN con N Jugadores, repartiendo
 * bolsillos y revelando las 5 comunitarias de una baraja barajada, y asignando
 * a cada Jugador una Ficha roja según la permutación `estrellas`.
 */
function construirShowdown(
  n: number,
  semilla: number | string,
  estrellas: number[],
): { jugadores: Jugador[]; golpe: EstadoGolpe } {
  const baraja = crearBarajaBarajada(semilla);
  const { bolsillos, resto } = repartirBolsillos(baraja, n);
  const flop = revelarFlop(resto);
  const turn = revelarTurn(flop.comunitarias, flop.resto);
  const river = revelarRiver(turn.comunitarias, turn.resto);

  const jugadores: Jugador[] = [];
  const porJugador: Record<string, Ficha[]> = {};
  for (let i = 0; i < n; i++) {
    const id = `J${i}`;
    jugadores.push({ id, nombre: `Jugador ${i}`, bolsillo: bolsillos[i]! });
    porJugador[id] = [{ color: "ROJO", estrellas: estrellas[i]! }];
  }

  const comunitarias: Carta[] = river.comunitarias;
  const golpe: EstadoGolpe = {
    numero: 1,
    ronda: "SHOWDOWN",
    baraja: river.resto,
    comunitarias,
    fichas: {
      numJugadores: n,
      centro: [],
      porJugador,
      colorActivo: "ROJO",
    },
    confirmados: [],
    reveladoShowdown: jugadores.length,
  };

  return { jugadores, golpe };
}

describe("Resolución del Showdown (PBT)", () => {
  // Feature: the-gang-game, Property 22: Para cualquier conjunto de manos de los Jugadores ordenadas según el valor ascendente de sus Fichas rojas, el Golpe se declara exitoso si y solo si la secuencia de fuerzas de las manos en ese orden es no decreciente según el comparador del Evaluador_Manos; en caso contrario se declara fracasado.
  // Validates: Requirements 8.3, 8.4
  it("Property 22: el éxito del Golpe equivale a fuerza no decreciente en el orden", () => {
    verificarPropiedad(
      fc.property(genCaso, ({ n, semilla, estrellas }) => {
        const { jugadores, golpe } = construirShowdown(n, semilla, estrellas);

        const resultado = resolverShowdown(jugadores, golpe);

        // El orden debe ser ascendente por estrellas de Ficha roja (biyección 1..N).
        expect(resultado.orden).toHaveLength(n);
        for (let i = 0; i + 1 < resultado.orden.length; i++) {
          expect(resultado.orden[i + 1]!.estrellasRojas).toBeGreaterThan(
            resultado.orden[i]!.estrellasRojas,
          );
        }

        // Lado derecho del bicondicional, calculado de forma independiente a
        // partir de `orden` y `comparar`: la secuencia de fuerzas es no
        // decreciente si para todo par consecutivo comparar(posterior, anterior) >= 0.
        let noDecreciente = true;
        for (let i = 0; i + 1 < resultado.orden.length; i++) {
          const anterior = resultado.orden[i]!;
          const posterior = resultado.orden[i + 1]!;

          // Re-evaluamos las manos de forma independiente desde los bolsillos y
          // las comunitarias para no depender de la mano almacenada en `orden`.
          const jugAnterior = jugadores.find(
            (j) => j.id === anterior.jugadorId,
          )!;
          const jugPosterior = jugadores.find(
            (j) => j.id === posterior.jugadorId,
          )!;
          const evalAnterior = evaluar(
            jugAnterior.bolsillo,
            golpe.comunitarias,
          );
          const evalPosterior = evaluar(
            jugPosterior.bolsillo,
            golpe.comunitarias,
          );
          expect(evalAnterior.ok).toBe(true);
          expect(evalPosterior.ok).toBe(true);
          if (!evalAnterior.ok || !evalPosterior.ok) {
            return; // inalcanzable: en el Showdown hay 7 cartas por Jugador.
          }

          if (comparar(evalPosterior.mano, evalAnterior.mano) < 0) {
            noDecreciente = false;
            break;
          }
        }

        // Bicondicional: éxito si y solo si la secuencia es no decreciente.
        expect(resultado.exito).toBe(noDecreciente);
        // Coherencia: hay violación registrada exactamente cuando hay fracaso.
        expect(resultado.violacion !== null).toBe(!resultado.exito);
      }),
    );
  });
});
