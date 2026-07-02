import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TERMINACION_DESCONEXION_MS } from '../src/dominio/modelos';
import type { VistaPartida } from '../src/dominio/proyeccion';
import { crearAplicacion } from '../src/servidor/aplicacion';
import { MensajeCliente } from '../src/servidor/coordinador';
import type { ConexionCliente } from '../src/servidor/tipos';

interface ConexionPrueba extends ConexionCliente {
  enviados: Array<{ tipo: string; payload: unknown }>;
}

function crearConexion(id: string): ConexionPrueba {
  const enviados: Array<{ tipo: string; payload: unknown }> = [];
  return {
    id,
    enviar(mensaje) {
      enviados.push(mensaje);
    },
    cerrar() {},
    enviados,
  };
}

function ultimaVista(conexion: ConexionPrueba): VistaPartida {
  const estados = conexion.enviados.filter((m) => m.tipo === 'ESTADO');
  expect(estados.length).toBeGreaterThan(0);
  return estados[estados.length - 1]!.payload as VistaPartida;
}

interface JugadorEnPartida {
  nombre: string;
  sessionId: string;
  conexion: ConexionPrueba;
}

function montarPartidaEnCurso(app: ReturnType<typeof crearAplicacion>): JugadorEnPartida[] {
  const nombres = ['Lobo', 'Zorro', 'Tejón'];
  const jugadores: JugadorEnPartida[] = [];

  for (const [indice, nombre] of nombres.entries()) {
    const conexion = crearConexion(`conexion-${indice}`);
    app.manejadores.alConectar(conexion);
    app.manejadores.alRecibirMensaje(conexion, {
      tipo: MensajeCliente.UNIRSE,
      payload: { nombre },
    });
    const sesion = app.gestor.obtenerSesionPorConexion(conexion.id);
    if (sesion === null) {
      throw new Error('Sesión no creada en la prueba');
    }
    jugadores.push({ nombre, sessionId: sesion.sessionId, conexion });
  }

  app.manejadores.alRecibirMensaje(jugadores[0]!.conexion, {
    tipo: MensajeCliente.INICIAR,
  });
  expect(app.coordinador.obtenerEstado().fase).toBe('EN_CURSO');

  return jugadores;
}

describe('aplicación: terminación por desconexión', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inicia cuenta atrás al desconectar un ladrón en EN_CURSO', () => {
    const app = crearAplicacion();
    const jugadores = montarPartidaEnCurso(app);
    const desconectado = jugadores[1]!;

    app.manejadores.alDesconectar(desconectado.conexion);

    const pendiente = app.coordinador.obtenerEstado().terminacionPorDesconexion;
    expect(pendiente?.jugadorId).toBe(desconectado.sessionId);
    expect(pendiente?.jugadorNombre).toBe(desconectado.nombre);

    const vista = ultimaVista(jugadores[0]!.conexion);
    expect(vista.terminacionPorDesconexion?.jugadorNombre).toBe(desconectado.nombre);
    expect(vista.jugadores.find((j) => j.id === desconectado.sessionId)?.conectado).toBe(false);
  });

  it('cancela la cuenta atrás si el ladrón reconecta a tiempo', () => {
    const app = crearAplicacion();
    const jugadores = montarPartidaEnCurso(app);
    const desconectado = jugadores[1]!;

    app.manejadores.alDesconectar(desconectado.conexion);
    expect(app.coordinador.obtenerEstado().terminacionPorDesconexion).not.toBeNull();

    const reconexion = crearConexion('conexion-reconexion');
    app.manejadores.alConectar(reconexion);
    app.manejadores.alRecibirMensaje(reconexion, {
      tipo: MensajeCliente.UNIRSE,
      payload: { nombre: desconectado.nombre },
    });

    expect(app.coordinador.obtenerEstado().terminacionPorDesconexion).toBeNull();
    expect(app.coordinador.obtenerEstado().fase).toBe('EN_CURSO');

    const vista = ultimaVista(jugadores[0]!.conexion);
    expect(vista.terminacionPorDesconexion).toBeNull();
    expect(vista.jugadores.find((j) => j.id === desconectado.sessionId)?.conectado).toBe(true);
  });

  it('vuelve al lobby cuando expira la ventana de reconexión', () => {
    const app = crearAplicacion();
    const jugadores = montarPartidaEnCurso(app);

    app.manejadores.alDesconectar(jugadores[1]!.conexion);
    vi.advanceTimersByTime(TERMINACION_DESCONEXION_MS);

    expect(app.coordinador.obtenerEstado().fase).toBe('LOBBY');
    expect(app.coordinador.obtenerEstado().terminacionPorDesconexion).toBeNull();

    const vista = ultimaVista(jugadores[0]!.conexion);
    expect(vista.fase).toBe('LOBBY');
    expect(vista.terminacionPorDesconexion).toBeNull();
  });
});
