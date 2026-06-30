// Lógica pura del Lobby de The Gang: registro y validación de Jugadores,
// abandono antes del inicio y condición de mínimo de Jugadores para iniciar.
//
// Todas las funciones son puras: reciben la lista de Jugadores y devuelven una
// nueva lista o un ErrorJuego, sin mutar la entrada. Esto satisface el
// Requirement 2 (Incorporación de jugadores a la partida).
// _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

import { MAX_JUGADORES, MIN_JUGADORES, type ErrorJuego, type Jugador } from './modelos';

// ===========================================================================
// Constantes del Lobby
// ===========================================================================

/** Longitud mínima de un nombre de Jugador (criterio 2.1). */
export const NOMBRE_LONGITUD_MIN = 1;
/** Longitud máxima de un nombre de Jugador (criterio 2.1). */
export const NOMBRE_LONGITUD_MAX = 20;

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
  | { ok: true; jugadores: Jugador[] }
  | { ok: false; error: ErrorJuego };

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
): ErrorJuego | null {
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return {
      codigo: 'NOMBRE_INVALIDO',
      mensaje: 'El nombre no puede estar vacío.',
    };
  }

  if (
    nombre.length < NOMBRE_LONGITUD_MIN ||
    nombre.length > NOMBRE_LONGITUD_MAX
  ) {
    return {
      codigo: 'NOMBRE_INVALIDO',
      mensaje: `El nombre debe tener entre ${NOMBRE_LONGITUD_MIN} y ${NOMBRE_LONGITUD_MAX} caracteres.`,
    };
  }

  if (jugadores.some((j) => j.nombre === nombre)) {
    return {
      codigo: 'NOMBRE_INVALIDO',
      mensaje: 'Ese alias ya lo usa otro miembro de la banda.',
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
): ResultadoRegistro {
  if (jugadores.length >= MAX_JUGADORES) {
    return {
      ok: false,
      error: {
        codigo: 'PARTIDA_COMPLETA',
        mensaje: 'La banda ya está completa: no caben más de 6 miembros.',
      },
    };
  }

  const errorNombre = validarNombre(nombre, jugadores);
  if (errorNombre !== null) {
    return { ok: false, error: errorNombre };
  }

  const nuevo: Jugador = { id, nombre, bolsillo: null };
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

// ===========================================================================
// Condición de inicio
// ===========================================================================

/**
 * Indica si el número de Jugadores registrados permite iniciar la Partida.
 * Se requieren al menos {@link MIN_JUGADORES} y como máximo
 * {@link MAX_JUGADORES} Jugadores (criterios 2.4, 3.1).
 */
export function puedeIniciar(jugadores: readonly Jugador[]): boolean {
  return (
    jugadores.length >= MIN_JUGADORES && jugadores.length <= MAX_JUGADORES
  );
}

/**
 * Valida que se pueda iniciar la Partida. Devuelve `null` si es posible, o un
 * `ErrorJuego` con código `JUGADORES_INSUFICIENTES` cuando hay menos de
 * {@link MIN_JUGADORES} Jugadores (criterio 2.4).
 */
export function validarInicio(jugadores: readonly Jugador[]): ErrorJuego | null {
  if (jugadores.length < MIN_JUGADORES) {
    return {
      codigo: 'JUGADORES_INSUFICIENTES',
      mensaje: `Se necesitan al menos ${MIN_JUGADORES} miembros para dar el golpe.`,
    };
  }
  return null;
}
