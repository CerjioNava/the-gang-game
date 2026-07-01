import { describe, expect, it } from 'vitest';

import {
  abandonarEspectador,
  registrarEspectador,
  registrarJugador,
} from '../src/dominio/lobby';
import { proyectarEstadoPara, BOLSILLO_OCULTO } from '../src/dominio/proyeccion';
import { Coordinador } from '../src/servidor/coordinador';

describe('registro de espectadores (lobby)', () => {
  it('registra un espectador con nombre único', () => {
    const jugadores = [{ id: 'j1', nombre: 'El Cerebro', bolsillo: null }];
    const resultado = registrarEspectador([], jugadores, 'El Informante', 's1');
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.espectadores).toHaveLength(1);
      expect(resultado.espectadores[0]?.nombre).toBe('El Informante');
    }
  });

  it('rechaza nombres duplicados entre jugadores y espectadores', () => {
    const jugadores = [{ id: 'j1', nombre: 'El Cerebro', bolsillo: null }];
    const espectadores = [{ id: 's1', nombre: 'La Sombra' }];

    const duplicadoJugador = registrarEspectador([], jugadores, 'El Cerebro', 's2');
    expect(duplicadoJugador.ok).toBe(false);

    const duplicadoEspectador = registrarEspectador(espectadores, jugadores, 'La Sombra', 's2');
    expect(duplicadoEspectador.ok).toBe(false);

    const jugadorDuplicado = registrarJugador([], 'La Sombra', 'j2', espectadores);
    expect(jugadorDuplicado.ok).toBe(false);
  });

  it('elimina un espectador al abandonar', () => {
    const lista = [
      { id: 's1', nombre: 'A' },
      { id: 's2', nombre: 'B' },
    ];
    expect(abandonarEspectador(lista, 's1')).toEqual([{ id: 's2', nombre: 'B' }]);
  });
});

describe('Coordinador: modo espectador', () => {
  function contextoConectados(...ids: string[]) {
    return { conexionPorJugador: new Map(ids.map((id) => [id, true])) };
  }

  function coordinadorConTresJugadores(): Coordinador {
    const c = new Coordinador({ generarSemilla: () => 42 });
    for (const [id, nombre] of [
      ['j1', 'Uno'],
      ['j2', 'Dos'],
      ['j3', 'Tres'],
    ] as const) {
      const r = c.procesarMensaje(id, { tipo: 'UNIRSE', payload: { nombre } });
      expect(r.clase).toBe('DIFUNDIR');
    }
    return c;
  }

  it('permite unirse como espectador con la Partida en curso', () => {
    const c = coordinadorConTresJugadores();
    const inicio = c.procesarMensaje(
      'j1',
      { tipo: 'INICIAR' },
      contextoConectados('j1', 'j2', 'j3'),
    );
    expect(inicio.clase).toBe('DIFUNDIR');

    const union = c.procesarMensaje('obs1', {
      tipo: 'UNIRSE',
      payload: { nombre: 'Observador', rol: 'ESPECTADOR' },
    });
    expect(union.clase).toBe('DIFUNDIR');
    expect(c.obtenerEstado().espectadores).toHaveLength(1);

    const vista = c.obtenerVistaPara('obs1');
    expect(vista.esEspectador).toBe(true);
    expect(
      vista.jugadores.every(
        (j) => j.bolsillo === BOLSILLO_OCULTO || j.bolsillo === null,
      ),
    ).toBe(true);
  });

  it('bloquea acciones de juego a los espectadores', () => {
    const c = coordinadorConTresJugadores();
    c.procesarMensaje('j1', { tipo: 'INICIAR' }, contextoConectados('j1', 'j2', 'j3'));
    c.procesarMensaje('obs1', {
      tipo: 'UNIRSE',
      payload: { nombre: 'Observador', rol: 'ESPECTADOR' },
    });

    const accion = c.procesarMensaje('obs1', { tipo: 'AVANZAR' });
    expect(accion.clase).toBe('ERROR');
    if (accion.clase === 'ERROR') {
      expect(accion.error.codigo).toBe('ACCION_NO_PERMITIDA');
    }
  });

  it('conserva espectadores al iniciar la Partida', () => {
    const c = coordinadorConTresJugadores();
    c.procesarMensaje('obs1', {
      tipo: 'UNIRSE',
      payload: { nombre: 'Observador', rol: 'ESPECTADOR' },
    });
    c.procesarMensaje('j1', { tipo: 'INICIAR' }, contextoConectados('j1', 'j2', 'j3', 'obs1'));

    expect(c.obtenerEstado().fase).toBe('EN_CURSO');
    expect(c.obtenerEstado().espectadores).toHaveLength(1);
  });
});

describe('proyección para espectadores', () => {
  it('marca esEspectador y lista de espectadores en la vista', () => {
    const c = new Coordinador();
    c.procesarMensaje('obs1', {
      tipo: 'UNIRSE',
      payload: { nombre: 'Observador', rol: 'ESPECTADOR' },
    });
    const vista = proyectarEstadoPara(c.obtenerEstado(), 'obs1');
    expect(vista.esEspectador).toBe(true);
    expect(vista.espectadores).toHaveLength(1);
  });
});
