// Cableado de la aplicación del Servidor_Local (tarea 17.1).
//
// Este módulo es el "pegamento" que une las piezas ya construidas en capas
// anteriores en un único conjunto de manejadores que la capa de transporte
// (Servidor_Local / `crearServidorLocal`) puede invocar:
//
//   Coordinador  -> dueño del ESTADO AUTORITATIVO de la Partida (LOBBY → ...).
//   GestorSesiones -> identidad de Jugador (sessionId) y reconexión por nombre.
//   Difusor      -> envía a cada cliente conectado su VISTA personalizada.
//
// Aquí se mantiene el `Map<conexionId, ConexionCliente>` de conexiones activas
// que el Difusor consulta para enviar mensajes, y se traduce cada evento del
// transporte (conectar / mensaje / desconectar) en operaciones sobre esas tres
// piezas.
//
// ───────────────────────────────────────────────────────────────────────────
// CORRESPONDENCIA DE IDENTIDAD: sessionId === jugadorId
// ───────────────────────────────────────────────────────────────────────────
// El Coordinador identifica a cada Jugador por un `jugadorId` estable. La capa
// de transporte trabaja con un `conexion.id` opaco y EFÍMERO (cambia en cada
// reconexión). El puente entre ambos es el GestorSesiones:
//
//   - Cuando llega UNIRSE { nombre }, `gestor.conectar(nombre, conexion.id)`
//     produce (o recupera) un `sessionId` y lo asocia a la conexión actual.
//   - Ese `sessionId` se usa como `jugadorId` al llamar al Coordinador, de modo
//     que el Jugador queda registrado con id = sessionId.
//   - En mensajes posteriores, el `jugadorId` se resuelve desde `conexion.id`
//     consultando la sesión asociada (`gestor.obtenerSesionPorConexion`).
//   - El Difusor proyecta la vista de cada Jugador con `obtenerVistaPara(
//     sessionId)`, usando el mismo `sessionId` como `jugadorId`.
//
// Mantener esta equivalencia (sessionId === jugadorId) es lo que garantiza que
// cada cliente reciba SUS Cartas de Bolsillo y no las ajenas, y que sus acciones
// se atribuyan al Jugador correcto.
//
// NOTA DE SEGURIDAD: pensado para una LAN de confianza. La identidad se basa en
// el nombre registrado más el token de sesión; cualquier equipo de la red puede
// conectarse. Limitación aceptada del alcance LAN inicial (ver design.md).
//
// _Requirements: 1.1, 1.2, 1.3_

import { crearCoordinador, MensajeCliente, MensajeServidor } from './coordinador';
import type { Coordinador, ContextoCoordinador, ResultadoCoordinador } from './coordinador';
import { generarNombreEspectador } from '../dominio/lobby';
import { crearDifusor } from './difusor';
import type { Difusor } from './difusor';
import { crearGestorSesiones } from './sesiones';
import type { GestorSesiones } from './sesiones';
import type {
  ConexionCliente,
  ManejadoresServidor,
  MensajeEntrante,
} from './tipos';

/**
 * Aplicación cableada del Servidor_Local. Expone los `manejadores` que se pasan
 * a `crearServidorLocal`, además de las piezas internas (coordinador, gestor,
 * difusor y el mapa de conexiones) para facilitar las pruebas de integración.
 */
export interface Aplicacion {
  /** Manejadores del canal WebSocket que consume la capa de transporte. */
  readonly manejadores: ManejadoresServidor;
  /** Dueño del estado autoritativo de la Partida. */
  readonly coordinador: Coordinador;
  /** Gestor de sesiones / reconexión por nombre. */
  readonly gestor: GestorSesiones;
  /** Difusor de vistas personalizadas a los clientes conectados. */
  readonly difusor: Difusor;
  /** Mapa vivo de conexiones activas (conexionId → ConexionCliente). */
  readonly conexiones: ReadonlyMap<string, ConexionCliente>;
}

/** Opciones de construcción de la aplicación (inyectables para pruebas). */
export interface OpcionesAplicacion {
  /** Coordinador a usar; por defecto, uno nuevo en fase LOBBY. */
  coordinador?: Coordinador;
  /** Gestor de sesiones a usar; por defecto, uno nuevo y vacío. */
  gestor?: GestorSesiones;
}

/**
 * Construye la aplicación: coordinador + gestor + difusor + el mapa de
 * conexiones activas, y devuelve los manejadores del servidor ya cableados.
 *
 * El resultado se pasa a `crearServidorLocal({ manejadores: app.manejadores })`
 * desde el punto de entrada (`index.ts`).
 */
export function crearAplicacion(opciones: OpcionesAplicacion = {}): Aplicacion {
  const coordinador = opciones.coordinador ?? crearCoordinador();
  const gestor = opciones.gestor ?? crearGestorSesiones();

  // Mapa vivo de conexiones activas que el Difusor consulta para enviar las
  // vistas. Lo poblamos en alConectar y lo vaciamos en alDesconectar.
  const conexiones = new Map<string, ConexionCliente>();
  const difusor = crearDifusor(conexiones, gestor, coordinador);

  /** El avance de ronda es solo por confirmación manual; no hay temporizador. */
  function asegurarSinTemporizador(): void {
    coordinador.fijarTemporizadorFinAt(null);
  }

  /**
   * Sincroniza la Partida del gestor con el estado autoritativo del
   * coordinador. El gestor necesita conocer la fase de la Partida para decidir,
   * en una desconexión, si preserva la sesión (EN_CURSO, para reconexión) o la
   * retira (LOBBY/FINALIZADA). Se registra la Partida la primera vez que deja el
   * LOBBY (gestor.crearPartida) y se actualiza en adelante.
   */
  function sincronizarPartida(): void {
    const estado = coordinador.obtenerEstado();
    if (estado.fase === 'LOBBY') {
      if (gestor.obtenerPartida() !== null) {
        gestor.actualizarPartida(estado);
      }
      return;
    }
    if (gestor.obtenerPartida() === null) {
      gestor.crearPartida(estado);
    } else {
      gestor.actualizarPartida(estado);
    }
  }

  /** Envía un error de juego SOLO al emisor (sin difundirlo a los demás). */
  function enviarError(conexion: ConexionCliente, mensaje: string, codigo?: string): void {
    conexion.enviar({
      tipo: MensajeServidor.ERROR,
      payload: codigo === undefined ? { mensaje } : { codigo, mensaje },
    });
  }

  /** Mapa jugadorId → conectado a partir de las sesiones del gestor. */
  function mapaConexion(): Map<string, boolean> {
    return new Map(
      gestor.sesiones().map((sesion) => [sesion.sessionId, sesion.conectado]),
    );
  }

  function contextoCoordinador(): ContextoCoordinador {
    return { conexionPorJugador: mapaConexion() };
  }

  /** Retira del gestor las sesiones indicadas por el Coordinador. */
  function retirarSesionesIndicadas(resultado: ResultadoCoordinador): void {
    if (resultado.clase !== 'DIFUNDIR' || resultado.sesionesARetirar === undefined) {
      return;
    }
    for (const sessionId of resultado.sesionesARetirar) {
      gestor.retirarSesion(sessionId);
    }
  }

  /**
   * Traduce el resultado del Coordinador en efectos de transporte:
   *   - DIFUNDIR  → sincroniza la Partida y difunde las vistas a todos.
   *   - PRIVADO   → envía el mensaje privado SOLO al emisor.
   *   - ERROR     → envía el error de juego SOLO al emisor; estado intacto.
   *   - IGNORADO  → envía un error genérico SOLO al emisor; estado intacto.
   */
  function aplicarResultado(
    resultado: ResultadoCoordinador,
    conexion: ConexionCliente | null,
  ): void {
    switch (resultado.clase) {
      case 'DIFUNDIR':
        retirarSesionesIndicadas(resultado);
        sincronizarPartida();
        difusor.difundir();
        asegurarSinTemporizador();
        break;
      case 'PRIVADO':
        conexion?.enviar(resultado.mensaje);
        break;
      case 'ERROR':
      case 'IGNORADO':
        if (conexion !== null) {
          enviarError(conexion, resultado.error.mensaje, resultado.error.codigo);
        }
        break;
    }
  }

  /**
   * Maneja el primer mensaje de identidad (UNIRSE). Obtiene/recupera el
   * sessionId desde el gestor y reenvía el registro al coordinador con
   * jugadorId = sessionId. Distingue alta nueva de RECONEXIÓN:
   *
   *   - Alta nueva: se reenvía UNIRSE al coordinador. Si el coordinador lo
   *     rechaza (p. ej. NOMBRE_INVALIDO, PARTIDA_COMPLETA), se revierte la
   *     sesión recién creada para no dejar sesiones huérfanas.
   *   - Reconexión (mismo nombre, Partida activa): NO se vuelve a registrar; el
   *     gestor ya reasoció la conexión y preservó el estado del Jugador. Solo se
   *     difunde el estado para que el cliente reincorporado reciba su vista.
   */
  function manejarUnirse(conexion: ConexionCliente, mensaje: MensajeEntrante): void {
    const payload = mensaje.payload;
    if (typeof payload !== 'object' || payload === null) {
      enviarError(conexion, 'Falta un payload válido para unirte.', 'NOMBRE_INVALIDO');
      return;
    }

    const rol =
      (payload as { rol?: unknown }).rol === 'ESPECTADOR'
        ? ('ESPECTADOR' as const)
        : ('JUGADOR' as const);

    let nombre: string | undefined;
    if (
      typeof (payload as { nombre?: unknown }).nombre === 'string' &&
      (payload as { nombre: string }).nombre.trim().length > 0
    ) {
      nombre = (payload as { nombre: string }).nombre;
    } else if (rol === 'ESPECTADOR') {
      const estado = coordinador.obtenerEstado();
      nombre = generarNombreEspectador(
        estado.espectadores ?? [],
        estado.jugadores,
      );
    } else {
      enviarError(conexion, 'Falta un nombre válido para unirte.', 'NOMBRE_INVALIDO');
      return;
    }

    const conexionResultado = gestor.conectar(nombre, conexion.id);
    if (!conexionResultado.ok) {
      // P. ej. PARTIDA_FINALIZADA: no admite alta ni reincorporación (criterio 1.8).
      enviarError(conexion, conexionResultado.error.mensaje, conexionResultado.error.codigo);
      return;
    }

    const sessionId = conexionResultado.sesion.sessionId;

    if (conexionResultado.esReconexion) {
      // Reincorporación (Lobby o Partida en curso): el estado ya está
      // preservado; basta con reenviarle (y a todos) la vista actual.
      difusor.difundir();
      return;
    }

    // Alta nueva: reenviar el registro al coordinador con jugadorId = sessionId.
    const resultado = coordinador.procesarMensaje(
      sessionId,
      mensaje,
      contextoCoordinador(),
    );
    aplicarResultado(resultado, conexion);

    // Si el registro fue rechazado, revertir la sesión para no dejarla huérfana.
    if (resultado.clase === 'ERROR' || resultado.clase === 'IGNORADO') {
      gestor.desconectar(conexion.id);
    }
  }

  const manejadores: ManejadoresServidor = {
    alConectar(conexion: ConexionCliente): void {
      // Registramos la conexión; la identidad del Jugador se establece cuando
      // llegue su mensaje UNIRSE.
      conexiones.set(conexion.id, conexion);
      difusor.enviarVistaInvitado(conexion);
    },

    alRecibirMensaje(conexion: ConexionCliente, mensaje: MensajeEntrante): void {
      const sesion = gestor.obtenerSesionPorConexion(conexion.id);

      if (sesion === null) {
        // Sin sesión todavía: el único mensaje admisible es UNIRSE.
        if (mensaje.tipo === MensajeCliente.UNIRSE) {
          manejarUnirse(conexion, mensaje);
        } else {
          enviarError(
            conexion,
            'Debes unirte con tu nombre antes de realizar otras acciones.',
            'ACCION_NO_PERMITIDA',
          );
        }
        return;
      }

      // Un UNIRSE de una conexión que ya tiene sesión se trata también como
      // reincorporación / refresco de vista (idempotente).
      if (mensaje.tipo === MensajeCliente.UNIRSE) {
        difusor.difundir();
        return;
      }

      // Mensaje posterior: jugadorId = sessionId de la sesión asociada.
      const resultado = coordinador.procesarMensaje(
        sesion.sessionId,
        mensaje,
        contextoCoordinador(),
      );
      aplicarResultado(resultado, conexion);
    },

    alDesconectar(conexion: ConexionCliente): void {
      // Retiramos la conexión del mapa vivo para que el Difusor no le envíe más.
      conexiones.delete(conexion.id);

      gestor.desconectar(conexion.id);

      asegurarSinTemporizador();
      // Difundimos el nuevo estado (p. ej. miembro desconectado en Lobby o Partida).
      difusor.difundir();
    },
  };

  return { manejadores, coordinador, gestor, difusor, conexiones };
}
