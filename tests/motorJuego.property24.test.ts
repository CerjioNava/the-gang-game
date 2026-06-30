import { describe, it, expect } from 'vitest';
import { fc, verificarPropiedad } from './pbt';
import { aplicarAccion } from '../src/dominio/motorJuego';
import { resolverShowdown } from '../src/dominio/showdown';
import {
  PALOS,
  VALOR_MINIMO,
  VALOR_MAXIMO,
  type Carta,
  type EstadoFichas,
  type EstadoGolpe,
  type EstadoPartida,
  type Ficha,
  type Jugador,
} from '../src/dominio/modelos';

// Prueba basada en propiedades del Motor_Juego de The Gang (fast-check + Vitest).
// _Requirements: 8.6, 8.7_
//
// Feature: the-gang-game, Property 24: Para cualquier estado de Partida, declarar
// un Golpe exitoso incrementa el número de Bóvedas en su lado dorado en
// exactamente uno, y declarar un Golpe fracasado incrementa el número de Alarmas
// en su lado rojo en exactamente uno; la otra cuenta permanece sin cambios.

/** Baraja completa de 52 cartas distintas (2..14 × 4 palos). */
const BARAJA_COMPLETA: Carta[] = PALOS.flatMap((palo) =>
  Array.from({ length: VALOR_MAXIMO - VALOR_MINIMO + 1 }, (_, i) => ({
    valor: VALOR_MINIMO + i,
    palo,
  })),
);

/** Genera el número de Jugadores N: entero entre 3 y 6 (Modo Básico). */
const genN: fc.Arbitrary<number> = fc.integer({ min: 3, max: 6 });

/** Construye N Jugadores con ids/nombres deterministas (j0..j{N-1}). */
function crearJugadores(n: number): Jugador[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `j${i}`,
    nombre: `Ladron ${i}`,
    bolsillo: null,
  }));
}

/**
 * Genera un estado de Partida en fase SHOWDOWN listo para resolverse:
 * - N Jugadores (3..6) cada uno con 2 Cartas de Bolsillo,
 * - 5 Cartas Comunitarias, todas las cartas en juego distintas entre sí,
 * - una Ficha roja por Jugador con valores de estrellas distintos (permutación 1..N),
 * - Bóvedas y Alarmas iniciales arbitrarias (< 2, para no terminar la Partida).
 */
const genEstadoShowdown: fc.Arbitrary<EstadoPartida> = genN.chain((n) => {
  const cartasNecesarias = 5 + 2 * n; // 5 comunitarias + 2 por Jugador
  return fc.record({
    cartas: fc.shuffledSubarray(BARAJA_COMPLETA, {
      minLength: cartasNecesarias,
      maxLength: cartasNecesarias,
    }),
    // Permutación de los valores de estrella 1..N para las Fichas rojas.
    estrellas: fc.shuffledSubarray(
      Array.from({ length: n }, (_, i) => i + 1),
      { minLength: n, maxLength: n },
    ),
    bovedasDoradas: fc.integer({ min: 0, max: 1 }),
    alarmasRojas: fc.integer({ min: 0, max: 1 }),
  }).map(({ cartas, estrellas, bovedasDoradas, alarmasRojas }) => {
    const comunitarias = cartas.slice(0, 5);
    const jugadoresBase = crearJugadores(n);

    const jugadores: Jugador[] = jugadoresBase.map((jugador, indice) => {
      const inicio = 5 + indice * 2;
      const bolsillo: [Carta, Carta] = [cartas[inicio]!, cartas[inicio + 1]!];
      return { ...jugador, bolsillo };
    });

    const porJugador: Record<string, Ficha[]> = {};
    jugadores.forEach((jugador, indice) => {
      porJugador[jugador.id] = [{ color: 'ROJO', estrellas: estrellas[indice]! }];
    });

    const fichas: EstadoFichas = {
      numJugadores: n,
      centro: [],
      porJugador,
      colorActivo: 'ROJO',
    };

    const golpeActual: EstadoGolpe = {
      numero: 1,
      ronda: 'SHOWDOWN',
      baraja: [],
      comunitarias,
      fichas,
    };

    const estado: EstadoPartida = {
      fase: 'EN_CURSO',
      jugadores,
      golpeActual,
      golpesJugados: 0,
      bovedasDoradas,
      alarmasRojas,
      resultado: null,
      semilla: 'property24',
    };
    return estado;
  });
});

describe('Property 24: El resultado del Golpe actualiza Bóvedas o Alarmas en exactamente uno', () => {
  it('un Golpe exitoso suma +1 Bóveda (Alarmas sin cambios) y uno fracasado suma +1 Alarma (Bóvedas sin cambios)', () => {
    verificarPropiedad(
      fc.property(genEstadoShowdown, (estado) => {
        // Predecir el resultado del Showdown a partir de la lógica pura.
        const exitoEsperado = resolverShowdown(
          estado.jugadores,
          estado.golpeActual!,
        ).exito;

        const bovedasAntes = estado.bovedasDoradas;
        const alarmasAntes = estado.alarmasRojas;

        const resultado = aplicarAccion(estado, { tipo: 'RESOLVER_SHOWDOWN' });

        // La resolución del Showdown en SHOWDOWN siempre es una acción válida.
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;

        const nuevo = resultado.estado;

        if (exitoEsperado) {
          // Golpe exitoso: +1 Bóveda, Alarmas sin cambios (criterio 8.6).
          expect(nuevo.bovedasDoradas).toBe(bovedasAntes + 1);
          expect(nuevo.alarmasRojas).toBe(alarmasAntes);
        } else {
          // Golpe fracasado: +1 Alarma, Bóvedas sin cambios (criterio 8.7).
          expect(nuevo.alarmasRojas).toBe(alarmasAntes + 1);
          expect(nuevo.bovedasDoradas).toBe(bovedasAntes);
        }

        // El evento de Showdown reportado coincide con el resultado predicho.
        const eventoShowdown = resultado.eventos.find(
          (e) => e.tipo === 'SHOWDOWN_RESUELTO',
        );
        expect(eventoShowdown).toBeDefined();
        if (eventoShowdown && eventoShowdown.tipo === 'SHOWDOWN_RESUELTO') {
          expect(eventoShowdown.exito).toBe(exitoEsperado);
        }
      }),
    );
  });
});
