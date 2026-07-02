import { describe, it, expect } from 'vitest';
import {
  crearCoordinador,
  MensajeCliente,
  type Coordinador,
  type ResultadoCoordinador,
} from '../src/servidor/coordinador';
import { crearDifusor } from '../src/servidor/difusor';
import { crearGestorSesiones, type GestorSesiones } from '../src/servidor/sesiones';
import type {
  ConexionCliente,
  MensajeEntrante,
  MensajeSaliente,
} from '../src/servidor/tipos';
import type { VistaPartida } from '../src/dominio/proyeccion';

// Pruebas de integración del Coordinador de Partida y el Difusor de Estado.
//
// Objetivo (tarea 14.3): verificar que un cambio en la lista de Jugadores, en
// las Fichas o en el resultado de la Partida dispara un broadcast a TODOS los
// clientes conectados, cada uno recibiendo su vista personalizada
// (criterios 2.6, 6.6, 9.3). Se prueba la colaboración real entre tres piezas:
//
//   procesarMensaje (Coordinador) --DIFUNDIR--> difundir (Difusor) --> ConexionCliente
//
// CORRESPONDENCIA DE IDENTIDAD: el Difusor proyecta la vista de cada sesión con
// `sesion.sessionId` como `jugadorId`. Por eso, al unir a un Jugador en el
// Coordinador, usamos como `jugadorId` el mismo `sessionId` que devolvió
// `gestor.conectar`. Mantener esa equivalencia es lo que garantiza que cada
// cliente reciba SU vista (sus Cartas de Bolsillo y no las ajenas).
//
// _Requirements: 2.6, 6.6, 9.3_

// ===========================================================================
// ConexionCliente simulada (fake) que registra los mensajes enviados
// ===========================================================================

interface ConexionFake extends ConexionCliente {
  /** Mensajes que el Difusor ha enviado a esta conexión, en orden. */
  readonly enviados: MensajeSaliente[];
}

/** Crea una ConexionCliente simulada que acumula los mensajes recibidos. */
function crearConexionFake(id: string): ConexionFake {
  const enviados: MensajeSaliente[] = [];
  return {
    id,
    enviar(mensaje: MensajeSaliente): void {
      enviados.push(mensaje);
    },
    cerrar(): void {
      /* sin efecto en la simulación */
    },
    enviados,
  };
}

/** Devuelve la última vista (payload de ESTADO) recibida por una conexión. */
function ultimaVista(conexion: ConexionFake): VistaPartida {
  const estados = conexion.enviados.filter((m) => m.tipo === 'ESTADO');
  expect(estados.length).toBeGreaterThan(0);
  return estados[estados.length - 1]!.payload as VistaPartida;
}

// ===========================================================================
// Banco de pruebas: 3 Jugadores conectados
// ===========================================================================

interface JugadorConectado {
  nombre: string;
  conexionId: string;
  /** sessionId === jugadorId que se pasa al Coordinador. */
  jugadorId: string;
  conexion: ConexionFake;
}

interface Banco {
  coordinador: Coordinador;
  gestor: GestorSesiones;
  difundir: () => number;
  jugadores: JugadorConectado[];
  /**
   * Procesa un mensaje a través del Coordinador y, SOLO si el resultado es
   * DIFUNDIR, dispara la difusión (igual que hará la integración real). Así, una
   * acción inválida (ERROR/IGNORADO) nunca produce un broadcast.
   */
  enviar: (jugadorId: string, mensaje: MensajeEntrante) => ResultadoCoordinador;
}

/** Monta coordinador + gestor + difusor con 3 ConexionCliente simuladas. */
function montarBanco(): Banco {
  // Semilla fija → barajado determinista y prueba reproducible.
  const coordinador = crearCoordinador({ generarSemilla: () => 'semilla-integracion' });
  const gestor = crearGestorSesiones();
  const conexiones = new Map<string, ConexionCliente>();

  const nombres = ['Lobo', 'Zorro', 'Tejón'];
  const jugadores: JugadorConectado[] = nombres.map((nombre, indice) => {
    const conexionId = `conexion-${indice + 1}`;
    const conexion = crearConexionFake(conexionId);
    conexiones.set(conexionId, conexion);

    // El transporte conecta la sesión; el sessionId resultante es la identidad
    // estable que usaremos como jugadorId frente al Coordinador.
    const resultado = gestor.conectar(nombre, conexionId);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) {
      throw new Error('No se pudo conectar la sesión de prueba.');
    }

    return { nombre, conexionId, jugadorId: resultado.sesion.sessionId, conexion };
  });

  const difusor = crearDifusor(conexiones, gestor, coordinador);

  const enviar = (jugadorId: string, mensaje: MensajeEntrante): ResultadoCoordinador => {
    const conexionPorJugador = new Map(
      gestor.sesiones().map((s) => [s.sessionId, s.conectado]),
    );
    const resultado = coordinador.procesarMensaje(jugadorId, mensaje, {
      conexionPorJugador,
    });
    if (resultado.clase === 'DIFUNDIR') {
      if (resultado.sesionesARetirar !== undefined) {
        for (const sessionId of resultado.sesionesARetirar) {
          gestor.retirarSesion(sessionId);
        }
      }
      difusor.difundir();
    }
    return resultado;
  };

  return {
    coordinador,
    gestor,
    difundir: () => difusor.difundir(),
    jugadores,
    enviar,
  };
}

/** Une a los tres Jugadores al Lobby, difundiendo tras cada alta. */
function unirTodos(banco: Banco): void {
  for (const jugador of banco.jugadores) {
    const resultado = banco.enviar(jugador.jugadorId, {
      tipo: MensajeCliente.UNIRSE,
      payload: { nombre: jugador.nombre },
    });
    expect(resultado.clase).toBe('DIFUNDIR');
  }
}

// ===========================================================================
// Escenario de integración
// ===========================================================================

describe('Integración Coordinador + Difusor: el cambio de Jugadores difunde a los conectados (criterio 2.6)', () => {
  it('cada UNIRSE devuelve DIFUNDIR y todos los clientes reciben ESTADO con la lista actualizada', () => {
    const banco = montarBanco();
    const [j1, j2, j3] = banco.jugadores;

    // Primer Jugador se une.
    expect(
      banco.enviar(j1!.jugadorId, {
        tipo: MensajeCliente.UNIRSE,
        payload: { nombre: j1!.nombre },
      }).clase,
    ).toBe('DIFUNDIR');

    // Las tres conexiones (todas conectadas) recibieron un ESTADO con 1 Jugador.
    for (const j of banco.jugadores) {
      const vista = ultimaVista(j.conexion);
      expect(vista.fase).toBe('LOBBY');
      expect(vista.jugadores.map((jv) => jv.nombre)).toEqual([j1!.nombre]);
    }

    // Segundo Jugador se une → la lista difundida crece a 2.
    expect(
      banco.enviar(j2!.jugadorId, {
        tipo: MensajeCliente.UNIRSE,
        payload: { nombre: j2!.nombre },
      }).clase,
    ).toBe('DIFUNDIR');
    for (const j of banco.jugadores) {
      expect(ultimaVista(j.conexion).jugadores.map((jv) => jv.nombre)).toEqual([
        j1!.nombre,
        j2!.nombre,
      ]);
    }

    // Tercer Jugador se une → la lista difundida crece a 3.
    expect(
      banco.enviar(j3!.jugadorId, {
        tipo: MensajeCliente.UNIRSE,
        payload: { nombre: j3!.nombre },
      }).clase,
    ).toBe('DIFUNDIR');
    for (const j of banco.jugadores) {
      expect(ultimaVista(j.conexion).jugadores.map((jv) => jv.nombre)).toEqual([
        j1!.nombre,
        j2!.nombre,
        j3!.nombre,
      ]);
    }
  });

  it('difundir() alcanza a los tres clientes conectados', () => {
    const banco = montarBanco();
    unirTodos(banco);
    // El broadcast llega a las tres conexiones activas (criterio 9.3: difusión
    // a todos los clientes conectados ante un cambio de estado).
    expect(banco.difundir()).toBe(3);
  });
});

describe('Integración Coordinador + Difusor: INICIAR y toma de Fichas difunden el cambio (criterio 6.6)', () => {
  it('INICIAR difunde una vista que refleja el Golpe en curso', () => {
    const banco = montarBanco();
    unirTodos(banco);

    const resultado = banco.enviar(banco.jugadores[0]!.jugadorId, {
      tipo: MensajeCliente.INICIAR,
    });
    expect(resultado.clase).toBe('DIFUNDIR');

    for (const j of banco.jugadores) {
      const vista = ultimaVista(j.conexion);
      expect(vista.fase).toBe('EN_CURSO');
      expect(vista.golpeActual).not.toBeNull();
      expect(vista.golpeActual!.numero).toBe(1);
      expect(vista.golpeActual!.ronda).toBe('PRE_FLOP');
      expect(vista.golpeActual!.fichas.colorActivo).toBe('BLANCO');
    }
  });

  it('cada TOMAR_FICHA difunde una vista que refleja el cambio de Fichas', () => {
    const banco = montarBanco();
    unirTodos(banco);
    banco.enviar(banco.jugadores[0]!.jugadorId, { tipo: MensajeCliente.INICIAR });

    // En PRE_FLOP el color activo es BLANCO; con 3 Jugadores hay fichas blancas
    // de 1, 2 y 3 estrellas. Cada Jugador toma una distinta.
    banco.jugadores.forEach((jugador, indice) => {
      const ficha = { color: 'BLANCO' as const, estrellas: indice + 1 };
      const resultado = banco.enviar(jugador.jugadorId, {
        tipo: MensajeCliente.TOMAR_FICHA,
        payload: { ficha },
      });
      expect(resultado.clase).toBe('DIFUNDIR');

      // Tras cada toma, todos los clientes ven la nueva asignación de Fichas.
      for (const observador of banco.jugadores) {
        const vista = ultimaVista(observador.conexion);
        expect(vista.golpeActual!.fichas.porJugador[jugador.jugadorId]).toEqual([
          ficha,
        ]);
        // La ficha tomada ya no está en el centro.
        const enCentro = vista.golpeActual!.fichas.centro.some(
          (f) => f.color === ficha.color && f.estrellas === ficha.estrellas,
        );
        expect(enCentro).toBe(false);
      }
    });

    // Al final, las tres fichas blancas están repartidas (centro sin blancas).
    const vistaFinal = ultimaVista(banco.jugadores[0]!.conexion);
    const blancasEnCentro = vistaFinal.golpeActual!.fichas.centro.filter(
      (f) => f.color === 'BLANCO',
    );
    expect(blancasEnCentro).toEqual([]);
  });
});

describe('Integración Coordinador + Difusor: estado de conexión visible en la vista', () => {
  /** Registra la Partida en el gestor (como hace la capa de aplicación al iniciar). */
  function sincronizarPartida(banco: Banco): void {
    const estado = banco.coordinador.obtenerEstado();
    if (estado.fase === 'LOBBY') {
      return;
    }
    if (banco.gestor.obtenerPartida() === null) {
      banco.gestor.crearPartida(estado);
    } else {
      banco.gestor.actualizarPartida(estado);
    }
  }

  it('en el Lobby, al desconectar un Jugador los demás ven conectado=false', () => {
    const banco = montarBanco();
    unirTodos(banco);

    const desconectado = banco.jugadores[1]!;
    banco.gestor.desconectar(desconectado.conexionId);
    banco.difundir();

    const vista = ultimaVista(banco.jugadores[0]!.conexion);
    expect(vista.fase).toBe('LOBBY');
    expect(vista.jugadores).toHaveLength(3);
    const jv = vista.jugadores.find((j) => j.id === desconectado.jugadorId);
    expect(jv?.conectado).toBe(false);
  });

  it('INICIAR se rechaza si algún miembro está desconectado', () => {
    const banco = montarBanco();
    unirTodos(banco);

    banco.gestor.desconectar(banco.jugadores[1]!.conexionId);

    const resultado = banco.enviar(banco.jugadores[0]!.jugadorId, {
      tipo: MensajeCliente.INICIAR,
    });
    expect(resultado.clase).toBe('ERROR');
    if (resultado.clase !== 'ERROR') return;
    expect(resultado.error.codigo).toBe('JUGADOR_DESCONECTADO');
    expect(banco.coordinador.obtenerEstado().fase).toBe('LOBBY');
  });

  it('cualquier ladrón puede expulsar a un miembro desconectado', () => {
    const banco = montarBanco();
    unirTodos(banco);

    const expulsado = banco.jugadores[2]!;
    banco.gestor.desconectar(expulsado.conexionId);

    const resultado = banco.enviar(banco.jugadores[1]!.jugadorId, {
      tipo: MensajeCliente.EXPULSAR,
      payload: { jugadorId: expulsado.jugadorId },
    });
    expect(resultado.clase).toBe('DIFUNDIR');

    const vista = ultimaVista(banco.jugadores[1]!.conexion);
    expect(vista.jugadores).toHaveLength(2);
    expect(vista.jugadores.some((j) => j.id === expulsado.jugadorId)).toBe(false);
  });

  it('al desconectar un Jugador durante la Partida, los demás ven conectado=false', () => {
    const banco = montarBanco();
    unirTodos(banco);
    banco.enviar(banco.jugadores[0]!.jugadorId, { tipo: MensajeCliente.INICIAR });
    sincronizarPartida(banco);

    const desconectado = banco.jugadores[1]!;
    banco.gestor.desconectar(desconectado.conexionId);
    banco.difundir();

    for (const observador of banco.jugadores) {
      if (observador.jugadorId === desconectado.jugadorId) {
        continue;
      }
      const vista = ultimaVista(observador.conexion);
      const jv = vista.jugadores.find((j) => j.id === desconectado.jugadorId);
      expect(jv?.conectado).toBe(false);
    }
  });

  it('al reconectar un Jugador, los demás vuelven a ver conectado=true', () => {
    const banco = montarBanco();
    unirTodos(banco);
    banco.enviar(banco.jugadores[0]!.jugadorId, { tipo: MensajeCliente.INICIAR });
    sincronizarPartida(banco);

    const jugador = banco.jugadores[1]!;
    banco.gestor.desconectar(jugador.conexionId);
    banco.difundir();

    const nuevaConexionId = `${jugador.conexionId}-nueva`;
    const reconexion = banco.gestor.conectar(jugador.nombre, nuevaConexionId);
    expect(reconexion.ok).toBe(true);
    if (!reconexion.ok) return;
    expect(reconexion.esReconexion).toBe(true);

    banco.difundir();

    const vista = ultimaVista(banco.jugadores[0]!.conexion);
    const jv = vista.jugadores.find((j) => j.id === jugador.jugadorId);
    expect(jv?.conectado).toBe(true);
  });
});

describe('Integración Coordinador + Difusor: privacidad de las Cartas de Bolsillo (criterio 4.2)', () => {
  it('la vista difundida a cada Jugador muestra su bolsillo y oculta los ajenos', () => {
    const banco = montarBanco();
    unirTodos(banco);
    banco.enviar(banco.jugadores[0]!.jugadorId, { tipo: MensajeCliente.INICIAR });

    for (const jugador of banco.jugadores) {
      const vista = ultimaVista(jugador.conexion);
      expect(vista.perspectivaJugadorId).toBe(jugador.jugadorId);

      for (const jv of vista.jugadores) {
        if (jv.id === jugador.jugadorId) {
          // El propio bolsillo es una pareja de Cartas visible.
          expect(Array.isArray(jv.bolsillo)).toBe(true);
          expect((jv.bolsillo as unknown[]).length).toBe(2);
        } else {
          // Los bolsillos ajenos están ocultos antes del Showdown.
          expect(jv.bolsillo).toBe('OCULTO');
        }
      }
    }
  });
});

describe('Integración Coordinador + Difusor: una acción inválida no difunde (criterios 6.6, 9.3)', () => {
  it('una toma inválida devuelve ERROR y NO envía un nuevo ESTADO a los demás', () => {
    const banco = montarBanco();
    unirTodos(banco);
    banco.enviar(banco.jugadores[0]!.jugadorId, { tipo: MensajeCliente.INICIAR });

    // Conteo de ESTADO recibidos por cada conexión antes de la acción inválida.
    const antes = banco.jugadores.map(
      (j) => j.conexion.enviados.filter((m) => m.tipo === 'ESTADO').length,
    );

    // Intento inválido: tomar una ficha ROJA cuando el color activo es BLANCO.
    const resultado = banco.enviar(banco.jugadores[0]!.jugadorId, {
      tipo: MensajeCliente.TOMAR_FICHA,
      payload: { ficha: { color: 'ROJO', estrellas: 1 } },
    });
    expect(resultado.clase).toBe('ERROR');

    // No se difundió: el conteo de ESTADO de cada conexión no cambió.
    const despues = banco.jugadores.map(
      (j) => j.conexion.enviados.filter((m) => m.tipo === 'ESTADO').length,
    );
    expect(despues).toEqual(antes);
  });
});
