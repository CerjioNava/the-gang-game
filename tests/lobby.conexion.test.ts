import { describe, it, expect } from 'vitest';
import {
  validarInicioConConectividad,
  puedeIniciarCompleto,
} from '../src/dominio/lobby';
import type { Jugador } from '../src/dominio/modelos';

function crearJugadores(n: number): Jugador[] {
  const alias = ['Lobo', 'Zorro', 'Tejón', 'Halcón', 'Pantera', 'Cuervo'];
  return Array.from({ length: n }, (_, i) => ({
    id: `j-${i}`,
    nombre: alias[i] ?? `Miembro ${i}`,
    bolsillo: null,
  }));
}

describe('Lobby: inicio con todos los miembros conectados', () => {
  it('validarInicioConConectividad rechaza si algún miembro está desconectado', () => {
    const jugadores = crearJugadores(3);
    const conexion = new Map<string, boolean>([
      ['j-0', true],
      ['j-1', false],
      ['j-2', true],
    ]);

    const error = validarInicioConConectividad(jugadores, conexion);
    expect(error?.codigo).toBe('JUGADOR_DESCONECTADO');
  });

  it('validarInicioConConectividad acepta cuando todos están conectados', () => {
    const jugadores = crearJugadores(3);
    const conexion = new Map<string, boolean>([
      ['j-0', true],
      ['j-1', true],
      ['j-2', true],
    ]);

    expect(validarInicioConConectividad(jugadores, conexion)).toBeNull();
  });

  it('puedeIniciarCompleto es false con miembros desconectados aunque haya 3+', () => {
    const jugadores = crearJugadores(4);
    const conexion = new Map<string, boolean>([
      ['j-0', true],
      ['j-1', true],
      ['j-2', true],
      ['j-3', false],
    ]);

    expect(puedeIniciarCompleto(jugadores, conexion)).toBe(false);
  });
});
