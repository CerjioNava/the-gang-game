import { describe, it, expect } from 'vitest';
import {
  registrarJugador,
  abandonarJugador,
  puedeIniciar,
  validarInicio,
} from '../src/dominio/lobby';
import type { Jugador } from '../src/dominio/modelos';

// Pruebas por ejemplo del Lobby de The Gang (no PBT).
// _Requirements: 2.4, 2.5_
//
// Cubren los criterios clasificados como EXAMPLE en el prework:
// - Inicio impedido con 0, 1, 2 Jugadores (criterio 2.4).
// - Lista de Jugadores visible/reflejada en LOBBY (criterio 2.5).

/** Construye una lista de N Jugadores con nombres temáticos únicos. */
function crearJugadores(n: number): Jugador[] {
  const alias = ['Lobo', 'Zorro', 'Tejón', 'Halcón', 'Pantera', 'Cuervo'];
  return Array.from({ length: n }, (_, i) => ({
    id: `j-${i}`,
    nombre: alias[i] ?? `Miembro ${i}`,
    bolsillo: null,
  }));
}

describe('Lobby: inicio impedido con menos de 3 Jugadores (criterio 2.4)', () => {
  it('validarInicio devuelve JUGADORES_INSUFICIENTES con 0 Jugadores', () => {
    const error = validarInicio([]);
    expect(error).not.toBeNull();
    expect(error?.codigo).toBe('JUGADORES_INSUFICIENTES');
  });

  it('validarInicio devuelve JUGADORES_INSUFICIENTES con 1 Jugador', () => {
    const error = validarInicio(crearJugadores(1));
    expect(error).not.toBeNull();
    expect(error?.codigo).toBe('JUGADORES_INSUFICIENTES');
  });

  it('validarInicio devuelve JUGADORES_INSUFICIENTES con 2 Jugadores', () => {
    const error = validarInicio(crearJugadores(2));
    expect(error).not.toBeNull();
    expect(error?.codigo).toBe('JUGADORES_INSUFICIENTES');
  });

  it('validarInicio devuelve null con 3 Jugadores (mínimo permitido)', () => {
    expect(validarInicio(crearJugadores(3))).toBeNull();
  });
});

describe('Lobby: puedeIniciar según el número de Jugadores (criterio 2.4)', () => {
  it('es false con 0, 1 y 2 Jugadores', () => {
    expect(puedeIniciar(crearJugadores(0))).toBe(false);
    expect(puedeIniciar(crearJugadores(1))).toBe(false);
    expect(puedeIniciar(crearJugadores(2))).toBe(false);
  });

  it('es true con 3, 4, 5 y 6 Jugadores', () => {
    expect(puedeIniciar(crearJugadores(3))).toBe(true);
    expect(puedeIniciar(crearJugadores(4))).toBe(true);
    expect(puedeIniciar(crearJugadores(5))).toBe(true);
    expect(puedeIniciar(crearJugadores(6))).toBe(true);
  });
});

describe('Lobby: lista de Jugadores reflejada en LOBBY (criterio 2.5)', () => {
  it('tras registrar varios Jugadores la lista refleja exactamente a los registrados', () => {
    let jugadores: Jugador[] = [];

    const r1 = registrarJugador(jugadores, 'Lobo', 'j-0');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    jugadores = r1.jugadores;

    const r2 = registrarJugador(jugadores, 'Zorro', 'j-1');
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    jugadores = r2.jugadores;

    const r3 = registrarJugador(jugadores, 'Halcón', 'j-2');
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    jugadores = r3.jugadores;

    // La lista visible en LOBBY contiene exactamente a los Jugadores registrados.
    expect(jugadores).toHaveLength(3);
    expect(jugadores.map((j) => j.nombre)).toEqual(['Lobo', 'Zorro', 'Halcón']);
    expect(jugadores.map((j) => j.id)).toEqual(['j-0', 'j-1', 'j-2']);
  });

  it('tras un abandono la lista deja de reflejar al Jugador que se marchó', () => {
    let jugadores = crearJugadores(3); // Lobo, Zorro, Tejón

    jugadores = abandonarJugador(jugadores, 'j-1'); // se va Zorro

    expect(jugadores).toHaveLength(2);
    expect(jugadores.map((j) => j.nombre)).toEqual(['Lobo', 'Tejón']);
    expect(jugadores.some((j) => j.id === 'j-1')).toBe(false);
  });
});
