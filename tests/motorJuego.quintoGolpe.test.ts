import { describe, it, expect } from 'vitest';
import {
  iniciarPartida,
  iniciarSiguienteGolpe,
  MAX_GOLPES,
} from '../src/dominio/motorJuego';
import type { EstadoPartida, Jugador } from '../src/dominio/modelos';

// Prueba por ejemplo del Motor_Juego de The Gang (no PBT).
// _Requirements: 3.7_
//
// Criterio 3.7: "WHEN finaliza el quinto Golpe sin que se haya cumplido una
// condición de fin de Partida, THE Motor_Juego SHALL finalizar la Partida sin
// iniciar Golpes adicionales."
//
// Este caso concreto inicia una Partida con 4 Jugadores y una semilla fija, y
// simula resolver Golpes sucesivos invocando iniciarSiguienteGolpe manteniendo
// los contadores de Bóvedas y Alarmas en valores que NO disparan el fin de
// Partida (1 y 1). Verifica que tras el quinto Golpe la Partida finaliza y que
// invocar de nuevo no crea más Golpes.

/** Construye una lista de N Jugadores con nombres temáticos únicos. */
function crearJugadores(n: number): Jugador[] {
  const alias = ['Lobo', 'Zorro', 'Tejón', 'Halcón', 'Pantera', 'Cuervo'];
  return Array.from({ length: n }, (_, i) => ({
    id: `j-${i}`,
    nombre: alias[i] ?? `Miembro ${i}`,
    bolsillo: null,
  }));
}

describe('Motor_Juego: finalización exacta tras el quinto Golpe (criterio 3.7)', () => {
  it('confirma que MAX_GOLPES es 5', () => {
    // El Modo Básico permite un máximo de cinco Golpes por Partida (criterio 3.6).
    expect(MAX_GOLPES).toBe(5);
  });

  it('finaliza la Partida tras resolver el quinto Golpe sin iniciar Golpes adicionales', () => {
    // Inicia la Partida con 4 Jugadores y una semilla fija.
    const jugadores = crearJugadores(4);
    let estado: EstadoPartida = iniciarPartida(jugadores, 'semilla-fija-3.7');

    // Tras iniciar: Golpe número 1 en Pre-Flop, ningún Golpe contabilizado aún.
    expect(estado.fase).toBe('EN_CURSO');
    expect(estado.golpeActual).not.toBeNull();
    expect(estado.golpeActual!.numero).toBe(1);
    expect(estado.golpeActual!.ronda).toBe('PRE_FLOP');
    expect(estado.golpesJugados).toBe(0);

    // Mantén Bóvedas y Alarmas en valores que NO disparan el fin de Partida
    // (el fin por contadores ocurre al alcanzar 3; con 1 y 1 nunca se dispara).
    estado = { ...estado, bovedasDoradas: 1, alarmasRojas: 1 };

    // Simula resolver los Golpes 1 → 2, 2 → 3, 3 → 4 y 4 → 5. Cada llamada
    // contabiliza el Golpe recién resuelto e inicia el siguiente en Pre-Flop.
    // Tras estas cuatro llamadas debe encadenarse hasta el quinto Golpe.
    for (let golpeEsperado = 2; golpeEsperado <= MAX_GOLPES; golpeEsperado++) {
      estado = iniciarSiguienteGolpe(estado);

      // Golpe intermedio iniciado: sigue en curso, en Pre-Flop, con el número
      // incrementado en uno respecto al anterior.
      expect(estado.fase).toBe('EN_CURSO');
      expect(estado.golpeActual).not.toBeNull();
      expect(estado.golpeActual!.numero).toBe(golpeEsperado);
      expect(estado.golpeActual!.ronda).toBe('PRE_FLOP');
      // Se han contabilizado tantos Golpes resueltos como (número actual - 1).
      expect(estado.golpesJugados).toBe(golpeEsperado - 1);
    }

    // Comprobación explícita de los Golpes intermedios 2, 3 y 4 alcanzados:
    // el quinto Golpe está ahora en curso (número 5) y aún no finalizó.
    expect(estado.golpeActual!.numero).toBe(5);
    expect(estado.golpesJugados).toBe(4);

    // Resuelve el quinto Golpe: la Partida debe finalizar sin iniciar más Golpes
    // (criterio 3.7) porque se ha alcanzado el máximo de cinco Golpes.
    estado = iniciarSiguienteGolpe(estado);
    expect(estado.fase).toBe('FINALIZADA');
    expect(estado.golpeActual).toBeNull();
    expect(estado.golpesJugados).toBe(5);

    // Invocar de nuevo no crea más Golpes: la Partida permanece finalizada y el
    // conteo de Golpes no excede cinco.
    const tras6aLlamada = iniciarSiguienteGolpe(estado);
    expect(tras6aLlamada.fase).toBe('FINALIZADA');
    expect(tras6aLlamada.golpeActual).toBeNull();
    // No se inician Golpes adicionales más allá del quinto.
    expect(tras6aLlamada.golpesJugados).toBeLessThanOrEqual(MAX_GOLPES + 1);
  });
});
