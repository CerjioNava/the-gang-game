// Lógica pura del Lobby de The Gang: registro y validación de Jugadores,
// abandono antes del inicio y condición de mínimo de Jugadores para iniciar.
//
// Todas las funciones son puras: reciben la lista de Jugadores y devuelven una
// nueva lista o un ErrorJuego, sin mutar la entrada. Esto satisface el
// Requirement 2 (Incorporación de jugadores a la partida).
// _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

import {
  AJUSTES_POR_DEFECTO,
  MAX_JUGADORES,
  MIN_JUGADORES,
  TERMINACION_DESCONEXION_MS,
  type ErrorJuego,
  type Espectador,
  type EstadoPartida,
  type Jugador,
} from "./modelos";

// ===========================================================================
// Constantes del Lobby
// ===========================================================================

/** Longitud mínima de un nombre de Jugador (criterio 2.1). */
export const NOMBRE_LONGITUD_MIN = 1;
/** Longitud máxima de un nombre de Jugador (criterio 2.1). */
export const NOMBRE_LONGITUD_MAX = 20;
/** Aforo máximo de espectadores simultáneos. */
export const MAX_ESPECTADORES = 20;
/** Longitud máxima de la descripción de un alias. */
export const DESCRIPCION_LONGITUD_MAX = 120;

// ===========================================================================
// Resultado del registro
// ===========================================================================

/**
 * Resultado de registrar un Jugador en el Lobby.
 *
 * En caso de éxito devuelve la nueva lista de Jugadores (la entrada nunca se
 * muta). En caso de rechazo devuelve el ErrorJuego con el motivo; la lista
 * original se conserva sin cambios (criterios 2.2, 2.3).
 */
export type ResultadoRegistro =
  { ok: true; jugadores: Jugador[] } | { ok: false; error: ErrorJuego };

// ===========================================================================
// Validación de nombres
// ===========================================================================

/**
 * Valida un nombre de Jugador frente a una lista de Jugadores ya registrados.
 *
 * Reglas (criterios 2.1, 2.2):
 * - No vacío: una cadena vacía o compuesta solo de espacios es inválida (se
 *   evalúa la emptiness sobre el nombre recortado con `trim`).
 * - Longitud entre 1 y 20 caracteres (se evalúa sobre la cadena original).
 * - Único: ningún otro Jugador de la lista puede tener exactamente ese nombre.
 *
 * @returns `null` si el nombre es válido, o un `ErrorJuego` con el motivo.
 */
export function validarNombre(
  nombre: string,
  jugadores: readonly Jugador[],
  espectadores: readonly Espectador[] = [],
  excluirJugadorId?: string,
): ErrorJuego | null {
  const jugadoresParaUnicidad =
    excluirJugadorId !== undefined
      ? jugadores.filter((j) => j.id !== excluirJugadorId)
      : jugadores;
  if (typeof nombre !== "string" || nombre.trim().length === 0) {
    return {
      codigo: "NOMBRE_INVALIDO",
      mensaje: "El nombre no puede estar vacío.",
    };
  }

  if (
    nombre.length < NOMBRE_LONGITUD_MIN ||
    nombre.length > NOMBRE_LONGITUD_MAX
  ) {
    return {
      codigo: "NOMBRE_INVALIDO",
      mensaje: `El nombre debe tener entre ${NOMBRE_LONGITUD_MIN} y ${NOMBRE_LONGITUD_MAX} caracteres.`,
    };
  }

  if (jugadoresParaUnicidad.some((j) => j.nombre === nombre)) {
    return {
      codigo: "NOMBRE_INVALIDO",
      mensaje: "Ese alias ya lo usa otro miembro de la banda.",
    };
  }

  if (espectadores.some((e) => e.nombre === nombre)) {
    return {
      codigo: "NOMBRE_INVALIDO",
      mensaje: "Ese alias ya lo usa otro espectador.",
    };
  }

  return null;
}

/**
 * Normaliza una descripción opcional: recorta espacios y devuelve undefined si queda vacía.
 */
export function normalizarDescripcion(
  descripcion: string | undefined,
): string | undefined {
  if (descripcion === undefined) {
    return undefined;
  }
  const recortada = descripcion.trim();
  return recortada.length > 0 ? recortada : undefined;
}

/**
 * Valida la descripción opcional de un alias.
 */
export function validarDescripcion(
  descripcion: string | undefined,
): ErrorJuego | null {
  if (descripcion === undefined) {
    return null;
  }
  if (descripcion.length > DESCRIPCION_LONGITUD_MAX) {
    return {
      codigo: "NOMBRE_INVALIDO",
      mensaje: `La descripción no puede superar ${DESCRIPCION_LONGITUD_MAX} caracteres.`,
    };
  }
  return null;
}

// ===========================================================================
// Registro y abandono
// ===========================================================================

/**
 * Registra un nuevo Jugador en el Lobby antes del inicio de la Partida.
 *
 * Valida el nombre (criterios 2.1, 2.2) y el aforo máximo de 6 Jugadores
 * (criterio 2.3). Ante cualquier rechazo, la lista original se conserva sin
 * cambios y se devuelve el motivo. En caso de éxito, devuelve una nueva lista
 * con exactamente un Jugador adicional con `bolsillo` en `null`.
 *
 * @param jugadores Lista actual de Jugadores registrados (no se muta).
 * @param nombre Nombre propuesto para el nuevo Jugador.
 * @param id Identificador único del nuevo Jugador.
 */
export function registrarJugador(
  jugadores: readonly Jugador[],
  nombre: string,
  id: string,
  espectadores: readonly Espectador[] = [],
  descripcion?: string,
): ResultadoRegistro {
  if (jugadores.length >= MAX_JUGADORES) {
    return {
      ok: false,
      error: {
        codigo: "PARTIDA_COMPLETA",
        mensaje: "La banda ya está completa: no caben más de 6 miembros.",
      },
    };
  }

  const errorNombre = validarNombre(nombre, jugadores, espectadores);
  if (errorNombre !== null) {
    return { ok: false, error: errorNombre };
  }

  const descripcionNorm = normalizarDescripcion(descripcion);
  const errorDescripcion = validarDescripcion(descripcionNorm);
  if (errorDescripcion !== null) {
    return { ok: false, error: errorDescripcion };
  }

  const nuevo: Jugador = {
    id,
    nombre,
    bolsillo: null,
    ...(descripcionNorm !== undefined ? { descripcion: descripcionNorm } : {}),
  };
  return { ok: true, jugadores: [...jugadores, nuevo] };
}

/**
 * Elimina del Lobby al Jugador con el id indicado (abandono antes del inicio,
 * criterio 2.6). Si el id no existe, la lista resultante es equivalente a la
 * original. La entrada nunca se muta.
 *
 * @returns Una nueva lista de Jugadores sin el Jugador indicado.
 */
export function abandonarJugador(
  jugadores: readonly Jugador[],
  jugadorId: string,
): Jugador[] {
  return jugadores.filter((j) => j.id !== jugadorId);
}

/**
 * Resultado de registrar un espectador.
 */
export type ResultadoRegistroEspectador =
  { ok: true; espectadores: Espectador[] } | { ok: false; error: ErrorJuego };

/**
 * Registra un espectador que observa la Partida sin jugar.
 */
export function registrarEspectador(
  espectadores: readonly Espectador[],
  jugadores: readonly Jugador[],
  nombre: string,
  id: string,
  descripcion?: string,
): ResultadoRegistroEspectador {
  if (espectadores.length >= MAX_ESPECTADORES) {
    return {
      ok: false,
      error: {
        codigo: "PARTIDA_COMPLETA",
        mensaje: "No caben más espectadores en esta Partida.",
      },
    };
  }

  const errorNombre = validarNombre(nombre, jugadores, espectadores);
  if (errorNombre !== null) {
    return { ok: false, error: errorNombre };
  }

  const descripcionNorm = normalizarDescripcion(descripcion);
  const errorDescripcion = validarDescripcion(descripcionNorm);
  if (errorDescripcion !== null) {
    return { ok: false, error: errorDescripcion };
  }

  const nuevo: Espectador = {
    id,
    nombre,
    ...(descripcionNorm !== undefined ? { descripcion: descripcionNorm } : {}),
  };
  return { ok: true, espectadores: [...espectadores, nuevo] };
}

/**
 * Genera un nombre interno único para un espectador sin alias visible.
 */
export function generarNombreEspectador(
  espectadores: readonly Espectador[],
  jugadores: readonly Jugador[],
): string {
  for (let indice = 1; indice <= MAX_ESPECTADORES + 1; indice += 1) {
    const candidato = `Espectador ${indice}`;
    if (validarNombre(candidato, jugadores, espectadores) === null) {
      return candidato;
    }
  }
  return `Espectador ${Date.now()}`;
}

/**
 * Actualiza alias y descripción de un jugador ya registrado en LOBBY.
 */
export function actualizarIdentidadJugador(
  jugadores: readonly Jugador[],
  espectadores: readonly Espectador[],
  jugadorId: string,
  nombre: string,
  descripcion?: string,
): ResultadoRegistro {
  const indice = jugadores.findIndex((j) => j.id === jugadorId);
  if (indice === -1) {
    return {
      ok: false,
      error: {
        codigo: "ACCION_NO_PERMITIDA",
        mensaje: "No estás registrado como miembro de la banda.",
      },
    };
  }

  const errorNombre = validarNombre(nombre, jugadores, espectadores, jugadorId);
  if (errorNombre !== null) {
    return { ok: false, error: errorNombre };
  }

  const descripcionNorm = normalizarDescripcion(descripcion);
  const errorDescripcion = validarDescripcion(descripcionNorm);
  if (errorDescripcion !== null) {
    return { ok: false, error: errorDescripcion };
  }

  const actualizados = jugadores.map((jugador) => {
    if (jugador.id !== jugadorId) {
      return jugador;
    }
    const actualizado: Jugador = {
      ...jugador,
      nombre,
    };
    if (descripcionNorm !== undefined) {
      return { ...actualizado, descripcion: descripcionNorm };
    }
    const { descripcion: _omitida, ...sinDescripcion } = actualizado;
    return sinDescripcion;
  });

  return { ok: true, jugadores: actualizados };
}

/**
 * Elimina un espectador de la lista (abandono o expulsión).
 */
export function abandonarEspectador(
  espectadores: readonly Espectador[],
  espectadorId: string,
): Espectador[] {
  return espectadores.filter((e) => e.id !== espectadorId);
}

// ===========================================================================
// Condición de inicio
// ===========================================================================

/**
 * Indica si el número de Jugadores registrados permite iniciar la Partida.
 * Se requieren al menos {@link MIN_JUGADORES} y como máximo
 * {@link MAX_JUGADORES} Jugadores (criterios 2.4, 3.1).
 */
export function puedeIniciar(jugadores: readonly Jugador[]): boolean {
  return jugadores.length >= MIN_JUGADORES && jugadores.length <= MAX_JUGADORES;
}

/**
 * Valida que se pueda iniciar la Partida. Devuelve `null` si es posible, o un
 * `ErrorJuego` con código `JUGADORES_INSUFICIENTES` cuando hay menos de
 * {@link MIN_JUGADORES} Jugadores (criterio 2.4).
 */
export function validarInicio(
  jugadores: readonly Jugador[],
): ErrorJuego | null {
  if (jugadores.length < MIN_JUGADORES) {
    return {
      codigo: "JUGADORES_INSUFICIENTES",
      mensaje: `Se necesitan al menos ${MIN_JUGADORES} miembros para dar el golpe.`,
    };
  }
  return null;
}

/**
 * Indica si todos los Jugadores registrados tienen conexión activa. Los ids que
 * no aparecen en el mapa se consideran desconectados.
 */
export function todosConectados(
  jugadores: readonly Jugador[],
  conexionPorJugador: ReadonlyMap<string, boolean>,
): boolean {
  return jugadores.every((j) => conexionPorJugador.get(j.id) === true);
}

/**
 * Valida que se pueda iniciar la Partida: número mínimo de Jugadores y que
 * todos estén conectados al Servidor_Local.
 */
export function validarInicioConConectividad(
  jugadores: readonly Jugador[],
  conexionPorJugador: ReadonlyMap<string, boolean>,
): ErrorJuego | null {
  const errorBase = validarInicio(jugadores);
  if (errorBase !== null) {
    return errorBase;
  }

  const offline = jugadores.find((j) => conexionPorJugador.get(j.id) !== true);
  if (offline !== undefined) {
    return {
      codigo: "JUGADOR_DESCONECTADO",
      mensaje: `${offline.nombre} está desconectado; todos deben estar activos para dar el golpe.`,
    };
  }

  return null;
}

/**
 * Indica si la Partida puede iniciarse: aforo válido y todos los miembros
 * conectados.
 */
export function puedeIniciarCompleto(
  jugadores: readonly Jugador[],
  conexionPorJugador: ReadonlyMap<string, boolean>,
): boolean {
  return (
    puedeIniciar(jugadores) && todosConectados(jugadores, conexionPorJugador)
  );
}

/**
 * Devuelve la Partida al Lobby conservando jugadores, espectadores y ajustes.
 * Limpia el Golpe en curso, marcadores e historial para poder iniciar de nuevo.
 */
export function volverAlLobby(estado: EstadoPartida): EstadoPartida {
  return {
    fase: "LOBBY",
    jugadores: estado.jugadores.map((j) => ({ ...j, bolsillo: null })),
    espectadores: estado.espectadores ?? [],
    golpeActual: null,
    golpesJugados: 0,
    bovedasDoradas: 0,
    alarmasRojas: 0,
    resultado: null,
    semilla: 0,
    ajustes: estado.ajustes ?? AJUSTES_POR_DEFECTO,
    historialGolpes: [],
    historialShowdowns: [],
    ultimoResultadoGolpe: null,
    ultimoShowdownResuelto: null,
    terminacionPorDesconexion: null,
    historialChat: [],
  };
}

/** Inicia la cuenta atrás por desconexión de un ladrón durante EN_CURSO. */
export function iniciarTerminacionPorDesconexion(
  estado: EstadoPartida,
  jugadorId: string,
  ahoraMs: number,
): EstadoPartida {
  if (estado.fase !== "EN_CURSO") {
    return estado;
  }
  const jugador = estado.jugadores.find((j) => j.id === jugadorId);
  if (jugador === undefined) {
    return estado;
  }
  return {
    ...estado,
    terminacionPorDesconexion: {
      jugadorId,
      jugadorNombre: jugador.nombre,
      terminaEn: ahoraMs + TERMINACION_DESCONEXION_MS,
    },
  };
}

/** Cancela la terminación pendiente por desconexión. */
export function cancelarTerminacionPorDesconexion(
  estado: EstadoPartida,
): EstadoPartida {
  if (estado.terminacionPorDesconexion == null) {
    return estado;
  }
  return { ...estado, terminacionPorDesconexion: null };
}

/** Si expiró la cuenta atrás, vuelve al lobby; si no, sin cambios. */
export function aplicarTerminacionPorDesconexionExpirada(
  estado: EstadoPartida,
  ahoraMs: number,
): EstadoPartida {
  const pendiente = estado.terminacionPorDesconexion;
  if (pendiente == null || pendiente.terminaEn > ahoraMs) {
    return estado;
  }
  return volverAlLobby(estado);
}
