import { describe, expect, it } from 'vitest';

import {
  calcularPosicionesAsientos,
  contarRivales,
} from '../src/cliente/vistas/mesa/posicionesAsientos';
import type { JugadorVisible } from '../src/cliente/protocolo';

function jugador(id: string): JugadorVisible {
  return { id, nombre: id, bolsillo: null, conectado: true };
}

describe('posicionesAsientos', () => {
  it('coloca al jugador local abajo y rivales en fila superior', () => {
    const jugadores = [jugador('j1'), jugador('j2'), jugador('j3'), jugador('j4')];
    const posiciones = calcularPosicionesAsientos(jugadores, 'j1');

    expect(posiciones.find((p) => p.esYo)?.zona).toBe('local');
    expect(posiciones.find((p) => p.esYo)).toMatchObject({ x: 50, y: 90, zona: 'local' });

    const rivales = posiciones.filter((p) => p.zona === 'rival');
    expect(rivales).toHaveLength(3);
    expect(rivales.every((p) => p.x >= 20 && p.x <= 80)).toBe(true);
  });

  it('con 5 rivales mantiene coordenadas dentro del arco del fieltro', () => {
    const jugadores = Array.from({ length: 6 }, (_, i) => jugador(`j${i + 1}`));
    const posiciones = calcularPosicionesAsientos(jugadores, 'j1');
    const rivales = posiciones.filter((p) => p.zona === 'rival');

    expect(rivales).toHaveLength(5);
    expect(rivales.every((p) => p.x >= 22 && p.x <= 78)).toBe(true);
  });

  it('en modo espectador distribuye a todos en la fila superior', () => {
    const jugadores = [jugador('j1'), jugador('j2'), jugador('j3')];
    const posiciones = calcularPosicionesAsientos(jugadores, null);

    expect(posiciones.every((p) => p.zona === 'rival')).toBe(true);
    expect(posiciones).toHaveLength(3);
    expect(contarRivales(jugadores, null)).toBe(3);
  });
});
