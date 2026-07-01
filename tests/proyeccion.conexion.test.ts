import { describe, it, expect } from 'vitest';
import {
  aplicarEstadoConexion,
  proyectarEstadoPara,
} from '../src/dominio/proyeccion';
import type { EstadoPartida, Jugador } from '../src/dominio/modelos';

function estadoEjemplo(): EstadoPartida {
  const jugadores: Jugador[] = [
    { id: 'j0', nombre: 'El Cerebro', bolsillo: null },
    { id: 'j1', nombre: 'La Sombra', bolsillo: null },
  ];
  return {
    fase: 'LOBBY',
    jugadores,
    golpeActual: null,
    golpesJugados: 0,
    bovedasDoradas: 0,
    alarmasRojas: 0,
    resultado: null,
    semilla: 'conexion-test',
  };
}

describe('aplicarEstadoConexion', () => {
  it('marca conectado=false en la vista cuando la sesión está desconectada', () => {
    const vista = proyectarEstadoPara(estadoEjemplo(), 'j0');
    expect(vista.jugadores.every((j) => j.conectado)).toBe(true);

    const conMapa = new Map<string, boolean>([
      ['j0', true],
      ['j1', false],
    ]);
    const enriquecida = aplicarEstadoConexion(vista, conMapa);

    expect(enriquecida.jugadores.find((j) => j.id === 'j0')?.conectado).toBe(true);
    expect(enriquecida.jugadores.find((j) => j.id === 'j1')?.conectado).toBe(false);
    expect(enriquecida.jugadores.find((j) => j.id === 'j1')?.nombre).toBe('La Sombra');
  });

  it('conserva el resto de campos de la vista sin mutar la original', () => {
    const vista = proyectarEstadoPara(estadoEjemplo(), 'j0');
    const instantanea = structuredClone(vista);
    const conMapa = new Map<string, boolean>([['j1', false]]);

    aplicarEstadoConexion(vista, conMapa);

    expect(vista).toEqual(instantanea);
  });
});
