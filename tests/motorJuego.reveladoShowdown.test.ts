import { describe, expect, it } from 'vitest';
import { aplicarAccion, iniciarPartida } from '../src/dominio/motorJuego';
import { ordenJugadoresShowdown } from '../src/dominio/showdown';
import type { Jugador, Semilla } from '../src/dominio/modelos';

const SEMILLA: Semilla = 'revelado-showdown-test';

function crearJugadores(n: number): Jugador[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `j${i + 1}`,
    nombre: `Ladron ${i + 1}`,
    bolsillo: null,
  }));
}

function llevarAShowdown(estadoInicial: ReturnType<typeof iniciarPartida>) {
  let estado = estadoInicial;
  for (let paso = 0; paso < 4; paso += 1) {
    const colorActivo = estado.golpeActual!.fichas.colorActivo;
    estado.jugadores.forEach((jugador, indice) => {
      const tomar = aplicarAccion(estado, {
        tipo: 'TOMAR_FICHA',
        jugadorId: jugador.id,
        ficha: { color: colorActivo, estrellas: indice + 1 },
      });
      expect(tomar.ok).toBe(true);
      if (tomar.ok) estado = tomar.estado;
    });
    for (const jugador of estado.jugadores) {
      const confirmar = aplicarAccion(estado, { tipo: 'CONFIRMAR', jugadorId: jugador.id });
      expect(confirmar.ok).toBe(true);
      if (confirmar.ok) estado = confirmar.estado;
    }
  }
  expect(estado.golpeActual!.ronda).toBe('SHOWDOWN');
  expect(estado.golpeActual!.reveladoShowdown).toBe(0);
  return estado;
}

describe('REVELAR_SHOWDOWN', () => {
  it('incrementa reveladoShowdown y emite SHOWDOWN_REVELADO en orden de ficha roja', () => {
    const estado = llevarAShowdown(iniciarPartida(crearJugadores(3), SEMILLA));
    const orden = ordenJugadoresShowdown(estado.jugadores, estado.golpeActual!.fichas);

    const r1 = aplicarAccion(estado, { tipo: 'REVELAR_SHOWDOWN' });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.estado.golpeActual!.reveladoShowdown).toBe(1);
    expect(r1.eventos).toEqual([{ tipo: 'SHOWDOWN_REVELADO', jugadorId: orden[0] }]);

    const r2 = aplicarAccion(r1.estado, { tipo: 'REVELAR_SHOWDOWN' });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.estado.golpeActual!.reveladoShowdown).toBe(2);

    const r3 = aplicarAccion(r2.estado, { tipo: 'REVELAR_SHOWDOWN' });
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(r3.estado.golpeActual!.reveladoShowdown).toBe(3);

    const r4 = aplicarAccion(r3.estado, { tipo: 'REVELAR_SHOWDOWN' });
    expect(r4.ok).toBe(false);
    if (r4.ok) return;
    expect(r4.error.codigo).toBe('ACCION_NO_PERMITIDA');
  });

  it('bloquea RESOLVER_SHOWDOWN hasta revelar todas las manos', () => {
    const estado = llevarAShowdown(iniciarPartida(crearJugadores(3), SEMILLA));

    const rechazo = aplicarAccion(estado, { tipo: 'RESOLVER_SHOWDOWN' });
    expect(rechazo.ok).toBe(false);
    if (rechazo.ok) return;
    expect(rechazo.error.mensaje).toMatch(/faltan manos/i);

    let actual = estado;
    for (let i = 0; i < 3; i += 1) {
      const rev = aplicarAccion(actual, { tipo: 'REVELAR_SHOWDOWN' });
      expect(rev.ok).toBe(true);
      if (!rev.ok) return;
      actual = rev.estado;
    }

    const resolver = aplicarAccion(actual, { tipo: 'RESOLVER_SHOWDOWN' });
    expect(resolver.ok).toBe(true);
  });
});
