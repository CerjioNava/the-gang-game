// Gestor de Sesiones del Servidor_Local: conexión, reconexión por nombre y
// garantía de una única Partida activa (tarea 13.2).
//
// Responsabilidades (Requirement 1):
//   - Alojar como máximo una Partida activa a la vez y rechazar la creación de
//     una segunda mientras exista una activa, conservando la existente
//     (criterios 1.4, 1.5).
//   - Registrar una SesionJugador por nombre generando un sessionId opaco; si el
//     nombre ya tiene sesión y la Partida sigue activa, tratar la nueva conexión
//     como una RECONEXIÓN (reasociar la conexión y marcar conectado = true)
//     preservando el estado del Jugador (criterios 1.6, 1.7).
//   - Ante una desconexión, marcar la sesión como desconectada SIN eliminar al
//     Jugador ni su estado mientras la Partida siga activa (criterio 1.6).
//   - Rechazar la reincorporación a una Partida ya finalizada con
//     PARTIDA_FINALIZADA (criterio 1.8).
//
// Diseño testeable: este módulo NO depende de `ws` ni de sockets. Las sesiones
// se asocian a un `conexionId` opaco (el id de {@link ConexionCliente}), de modo
// que la lógica de sesiones/reconexión puede probarse sin transporte real. El
// estado autoritativo de la Partida (EstadoPartida del dominio) se guarda por
// referencia; el Coordinador (tarea 14) lo actualiza mediante
// {@link GestorSesiones.actualizarPartida}.
//
// Todas las operaciones encapsulan su estado interno: las sesiones devueltas son
// copias defensivas para que un consumidor externo no pueda corromper el
// registro interno.

import { randomUUID } from 'node:crypto';
import type { EstadoPartida, ErrorJuego } from '../dominio';

// ===========================================================================
// Tipos públicos
// ===========================================================================

/**
 * Sesión de un Jugador conectado al Servidor_Local.
 *
 * Se alinea con `SesionJugador` del documento de diseño, pero usa `conexionId`
 * (id opaco de la conexión) en lugar de un `WebSocket` directo, para mantener la
 * lógica de sesiones desacoplada del transporte y testeable.
 */
export interface SesionJugador {
  /** Token opaco de la sesión, estable a través de reconexiones. */
  readonly sessionId: string;
  /** Nombre registrado del Jugador; único dentro de la Partida. */
  readonly nombre: string;
  /** Indica si la sesión tiene actualmente una conexión activa. */
  readonly conectado: boolean;
  /** Id de la conexión actualmente asociada, o null si está desconectada. */
  readonly conexionId: string | null;
}

/**
 * Resultado de conectar (o reconectar) un Jugador por su nombre.
 *
 * En caso de éxito incluye la sesión resultante y si la conexión fue una
 * reincorporación (`esReconexion = true`) o un alta nueva. En caso de rechazo
 * devuelve el `ErrorJuego` con el motivo (p. ej. PARTIDA_FINALIZADA).
 */
export type ResultadoConexion =
  | { ok: true; sesion: SesionJugador; esReconexion: boolean }
  | { ok: false; error: ErrorJuego };

/**
 * Resultado de registrar la Partida única en el gestor.
 *
 * Si ya existe una Partida activa, el registro se rechaza con PARTIDA_EN_CURSO y
 * la Partida existente se conserva intacta (criterio 1.5).
 */
export type ResultadoCrearPartida =
  | { ok: true; estado: EstadoPartida }
  | { ok: false; error: ErrorJuego };

/**
 * Gestor de Sesiones: administra las SesionJugador y la Partida única del
 * Servidor_Local. Implementación pura respecto al transporte (no conoce `ws`).
 */
export interface GestorSesiones {
  /**
   * Registra la Partida única del servidor. Rechaza con PARTIDA_EN_CURSO si ya
   * hay una Partida activa (no finalizada), conservando la existente
   * (criterios 1.4, 1.5).
   */
  crearPartida(estado: EstadoPartida): ResultadoCrearPartida;
  /**
   * Actualiza el estado autoritativo de la Partida ya registrada (lo invoca el
   * Coordinador tras aplicar acciones, incluida la transición a FINALIZADA).
   */
  actualizarPartida(estado: EstadoPartida): void;
  /** Devuelve el estado actual de la Partida, o null si no hay ninguna. */
  obtenerPartida(): EstadoPartida | null;
  /** Indica si hay una Partida registrada y aún no finalizada. */
  hayPartidaActiva(): boolean;

  /**
   * Conecta un Jugador por su nombre. Si el nombre ya tiene sesión y la Partida
   * no ha finalizado, reasocia la conexión y marca la sesión como conectada
   * (RECONEXIÓN, criterios 1.6, 1.7). Si es un nombre nuevo, genera un sessionId
   * opaco y crea la sesión. Si la Partida ya finalizó, rechaza con
   * PARTIDA_FINALIZADA (criterio 1.8).
   */
  conectar(nombre: string, conexionId: string): ResultadoConexion;
  /**
   * Marca como desconectada la sesión asociada a la conexión indicada. Mientras
   * la Partida siga activa (EN_CURSO) conserva la sesión y su estado
   * (conectado = false, conexionId = null) (criterio 1.6). Si no hay Partida en
   * curso (LOBBY o FINALIZADA), elimina la sesión. Devuelve la sesión afectada o
   * null si la conexión no estaba asociada a ninguna sesión.
   */
  desconectar(conexionId: string): SesionJugador | null;

  /** Busca una sesión por su sessionId. */
  obtenerSesion(sessionId: string): SesionJugador | null;
  /** Busca la sesión asociada a una conexión activa. */
  obtenerSesionPorConexion(conexionId: string): SesionJugador | null;
  /** Busca la sesión registrada con un nombre. */
  obtenerSesionPorNombre(nombre: string): SesionJugador | null;
  /** Devuelve una copia de todas las sesiones registradas. */
  sesiones(): SesionJugador[];
}

// ===========================================================================
// Implementación interna
// ===========================================================================

/** Estado mutable interno de una sesión (se expone solo como copia inmutable). */
interface SesionInterna {
  sessionId: string;
  nombre: string;
  conectado: boolean;
  conexionId: string | null;
}

/** Construye una copia inmutable de una sesión interna para exponerla. */
function copiar(sesion: SesionInterna): SesionJugador {
  return {
    sessionId: sesion.sessionId,
    nombre: sesion.nombre,
    conectado: sesion.conectado,
    conexionId: sesion.conexionId,
  };
}

/** Error de juego de reincorporación a una Partida finalizada (criterio 1.8). */
function errorPartidaFinalizada(): ErrorJuego {
  return {
    codigo: 'PARTIDA_FINALIZADA',
    mensaje: 'El golpe ya terminó: no puedes reincorporarte a esta Partida.',
  };
}

/** Error de juego de intento de crear una segunda Partida (criterio 1.5). */
function errorPartidaEnCurso(): ErrorJuego {
  return {
    codigo: 'PARTIDA_EN_CURSO',
    mensaje: 'Ya hay una Partida en curso; no se puede iniciar otra.',
  };
}

/**
 * Crea un nuevo Gestor de Sesiones con su propio estado encapsulado.
 *
 * El generador de identificadores de sesión es inyectable para facilitar las
 * pruebas deterministas; por defecto usa {@link randomUUID}, que produce un
 * token opaco e impredecible.
 *
 * @param generarSessionId Función que produce un sessionId opaco (por defecto, UUID v4).
 * _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8_
 */
export function crearGestorSesiones(
  generarSessionId: () => string = randomUUID,
): GestorSesiones {
  /** Partida única del servidor; null mientras no se haya registrado ninguna. */
  let partida: EstadoPartida | null = null;
  /** Sesiones indexadas por sessionId. */
  const porSessionId = new Map<string, SesionInterna>();
  /** Índice secundario: nombre → sessionId (los nombres son únicos). */
  const porNombre = new Map<string, string>();
  /** Índice secundario: conexionId activa → sessionId. */
  const porConexion = new Map<string, string>();

  /** Una Partida está activa si existe y aún no ha finalizado. */
  function partidaActiva(): boolean {
    return partida !== null && partida.fase !== 'FINALIZADA';
  }

  /** Una Partida está finalizada si existe y su fase es FINALIZADA. */
  function partidaFinalizada(): boolean {
    return partida !== null && partida.fase === 'FINALIZADA';
  }

  function crearPartida(estado: EstadoPartida): ResultadoCrearPartida {
    // Rechaza la segunda Partida mientras haya una activa, conservando la
    // existente sin tocarla (criterios 1.4, 1.5).
    if (partidaActiva()) {
      return { ok: false, error: errorPartidaEnCurso() };
    }
    partida = estado;
    return { ok: true, estado };
  }

  function actualizarPartida(estado: EstadoPartida): void {
    partida = estado;
  }

  function obtenerPartida(): EstadoPartida | null {
    return partida;
  }

  function conectar(nombre: string, conexionId: string): ResultadoConexion {
    const sessionIdExistente = porNombre.get(nombre);
    const existente =
      sessionIdExistente !== undefined ? porSessionId.get(sessionIdExistente) : undefined;

    // No se admite reincorporación ni alta nueva si la Partida ya finalizó
    // (criterio 1.8).
    if (partidaFinalizada()) {
      return { ok: false, error: errorPartidaFinalizada() };
    }

    if (existente !== undefined) {
      // RECONEXIÓN: el nombre ya tiene sesión y la Partida sigue activa. Se
      // reasocia la nueva conexión y se marca conectado; el estado del Jugador
      // (que vive en EstadoPartida) no se altera (criterios 1.6, 1.7).
      if (existente.conexionId !== null && existente.conexionId !== conexionId) {
        porConexion.delete(existente.conexionId);
      }
      existente.conexionId = conexionId;
      existente.conectado = true;
      porConexion.set(conexionId, existente.sessionId);
      return { ok: true, sesion: copiar(existente), esReconexion: true };
    }

    // Alta nueva: genera un sessionId opaco y registra la sesión.
    const sessionId = generarSessionId();
    const sesion: SesionInterna = {
      sessionId,
      nombre,
      conectado: true,
      conexionId,
    };
    porSessionId.set(sessionId, sesion);
    porNombre.set(nombre, sessionId);
    porConexion.set(conexionId, sessionId);
    return { ok: true, sesion: copiar(sesion), esReconexion: false };
  }

  function desconectar(conexionId: string): SesionJugador | null {
    const sessionId = porConexion.get(conexionId);
    if (sessionId === undefined) {
      return null;
    }
    porConexion.delete(conexionId);

    const sesion = porSessionId.get(sessionId);
    if (sesion === undefined) {
      return null;
    }

    // Mientras la Partida esté en curso, se preserva la sesión y el estado del
    // Jugador; solo se marca como desconectada (criterio 1.6).
    if (partida !== null && partida.fase === 'EN_CURSO') {
      sesion.conectado = false;
      sesion.conexionId = null;
      return copiar(sesion);
    }

    // Sin Partida en curso (LOBBY o FINALIZADA): la sesión se retira por
    // completo (abandono antes del inicio o limpieza tras finalizar).
    porSessionId.delete(sessionId);
    porNombre.delete(sesion.nombre);
    return copiar({ ...sesion, conectado: false, conexionId: null });
  }

  function obtenerSesion(sessionId: string): SesionJugador | null {
    const sesion = porSessionId.get(sessionId);
    return sesion !== undefined ? copiar(sesion) : null;
  }

  function obtenerSesionPorConexion(conexionId: string): SesionJugador | null {
    const sessionId = porConexion.get(conexionId);
    if (sessionId === undefined) {
      return null;
    }
    const sesion = porSessionId.get(sessionId);
    return sesion !== undefined ? copiar(sesion) : null;
  }

  function obtenerSesionPorNombre(nombre: string): SesionJugador | null {
    const sessionId = porNombre.get(nombre);
    if (sessionId === undefined) {
      return null;
    }
    const sesion = porSessionId.get(sessionId);
    return sesion !== undefined ? copiar(sesion) : null;
  }

  function sesiones(): SesionJugador[] {
    return Array.from(porSessionId.values(), copiar);
  }

  return {
    crearPartida,
    actualizarPartida,
    obtenerPartida,
    hayPartidaActiva: partidaActiva,
    conectar,
    desconectar,
    obtenerSesion,
    obtenerSesionPorConexion,
    obtenerSesionPorNombre,
    sesiones,
  };
}
