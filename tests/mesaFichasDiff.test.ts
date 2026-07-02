import { describe, expect, it } from 'vitest';

import type { EstadoFichas, Ficha } from '../src/dominio/modelos';
import { detectarMovimientosFichas } from '../src/cliente/vistas/mesa/mesaFichasDiff';

function ficha(color: Ficha['color'], estrellas: number): Ficha {
  return { color, estrellas };
}

function estadoFichas(partial: Partial<EstadoFichas> & Pick<EstadoFichas, 'centro' | 'porJugador'>): EstadoFichas {
  return {
    numJugadores: 4,
    colorActivo: 'AMARILLO',
    ...partial,
  };
}

describe('detectarMovimientosFichas', () => {
  it('detecta tomar ficha del centro a la mano de un jugador', () => {
    const prev = estadoFichas({
      centro: [ficha('AMARILLO', 1), ficha('AMARILLO', 2)],
      porJugador: { j1: [], j2: [ficha('BLANCO', 1)] },
    });
    const next = estadoFichas({
      centro: [ficha('AMARILLO', 2)],
      porJugador: { j1: [ficha('AMARILLO', 1)], j2: [ficha('BLANCO', 1)] },
    });

    const movs = detectarMovimientosFichas(prev, next);
    expect(movs).toHaveLength(1);
    expect(movs[0]?.ficha).toEqual(ficha('AMARILLO', 1));
    expect(movs[0]?.origen).toBe('centro');
    expect(movs[0]?.destino).toEqual({ jugadorId: 'j1' });
  });

  it('detecta intercambio centro ↔ jugador', () => {
    const prev = estadoFichas({
      centro: [ficha('AMARILLO', 1), ficha('AMARILLO', 3)],
      porJugador: { j1: [ficha('AMARILLO', 2)] },
    });
    const next = estadoFichas({
      centro: [ficha('AMARILLO', 2), ficha('AMARILLO', 3)],
      porJugador: { j1: [ficha('AMARILLO', 1)] },
    });

    const movs = detectarMovimientosFichas(prev, next);
    expect(movs).toHaveLength(2);
    expect(movs.some((m) => m.ficha.estrellas === 1 && m.origen === 'centro')).toBe(true);
    expect(movs.some((m) => m.ficha.estrellas === 2 && m.destino === 'centro')).toBe(true);
  });

  it('detecta intercambio entre dos jugadores', () => {
    const prev = estadoFichas({
      centro: [],
      porJugador: {
        j1: [ficha('AMARILLO', 1)],
        j2: [ficha('AMARILLO', 2)],
      },
    });
    const next = estadoFichas({
      centro: [],
      porJugador: {
        j1: [ficha('AMARILLO', 2)],
        j2: [ficha('AMARILLO', 1)],
      },
    });

    const movs = detectarMovimientosFichas(prev, next);
    expect(movs).toHaveLength(2);
    expect(
      movs.some(
        (m) =>
          m.ficha.estrellas === 1 &&
          typeof m.origen === 'object' &&
          m.origen.jugadorId === 'j1' &&
          typeof m.destino === 'object' &&
          m.destino.jugadorId === 'j2',
      ),
    ).toBe(true);
  });

  it('no reporta movimientos si las fichas no cambiaron de sitio', () => {
    const estado = estadoFichas({
      centro: [ficha('AMARILLO', 1)],
      porJugador: { j1: [ficha('BLANCO', 2)] },
    });
    expect(detectarMovimientosFichas(estado, estado)).toHaveLength(0);
  });
});
