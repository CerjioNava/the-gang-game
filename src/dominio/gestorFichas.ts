// Gestor_Fichas: lógica pura para administrar la disponibilidad, toma e
// intercambio de Fichas. Este archivo implementa, por ahora, la preparación de
// Fichas y la consulta de disponibilidad por color activo (tarea 6.1). La toma
// y el intercambio (tarea 6.2) se añadirán sobre esta misma estructura.
//
// _Requirements: 5.1, 5.2, 5.3, 5.4_

import {
  COLORES_FICHA,
  MAX_JUGADORES,
  MIN_JUGADORES,
  type ColorFicha,
  type EstadoFichas,
  type Ficha,
  type ResultadoFichas,
} from './modelos';

/**
 * Prepara el estado inicial de las Fichas para una Partida de N Jugadores.
 *
 * Conforme a los criterios 5.1 y 5.2/5.3, se retiran todas las Fichas cuyo
 * valor en estrellas sea superior a N y se produce exactamente una Ficha por
 * cada valor de estrellas entre 1 y N para cada uno de los cuatro colores
 * (blanco, amarillo, naranja y rojo). Todas las Fichas quedan en el centro;
 * la disponibilidad real por Ronda la gobierna `colorActivo` a través de
 * {@link fichasDisponibles} (criterio 5.4).
 *
 * La Ronda inicial de un Golpe es Pre-Flop, cuyo color es el blanco, por lo que
 * el color activo de partida es `BLANCO`.
 *
 * @param numJugadores Número de Jugadores N, entero entre 3 y 6.
 * @returns Estado de Fichas inicial con el centro poblado y sin posesiones.
 * @throws {RangeError} Si `numJugadores` no es un entero entre 3 y 6.
 */
export function prepararFichas(numJugadores: number): EstadoFichas {
  if (
    !Number.isInteger(numJugadores) ||
    numJugadores < MIN_JUGADORES ||
    numJugadores > MAX_JUGADORES
  ) {
    throw new RangeError(
      `numJugadores debe ser un entero entre ${MIN_JUGADORES} y ${MAX_JUGADORES}, se recibió: ${numJugadores}`,
    );
  }

  const centro: Ficha[] = [];
  for (const color of COLORES_FICHA) {
    // Una Ficha por cada valor de estrellas 1..N; los valores superiores a N
    // quedan retirados al no generarse (criterio 5.1).
    for (let estrellas = 1; estrellas <= numJugadores; estrellas++) {
      centro.push({ color, estrellas });
    }
  }

  return {
    numJugadores,
    centro,
    porJugador: {},
    colorActivo: 'BLANCO',
  };
}

/**
 * Devuelve las Fichas del color indicado que están disponibles para tomar.
 *
 * Una Ficha está disponible cuando se encuentra en el centro y su color es el
 * color de la Ronda activa (criterio 5.3). Mientras un color no sea el color
 * activo, sus Fichas se consideran no disponibles, por lo que la consulta
 * devuelve el conjunto vacío (criterio 5.4).
 *
 * @param estado Estado actual de las Fichas.
 * @param color Color cuya disponibilidad se consulta.
 * @returns Lista de Fichas disponibles de ese color (vacía si no es el activo).
 */
export function fichasDisponibles(
  estado: EstadoFichas,
  color: ColorFicha,
): Ficha[] {
  if (color !== estado.colorActivo) {
    return [];
  }
  return estado.centro.filter((ficha) => ficha.color === color);
}

// ===========================================================================
// Toma e intercambio de Fichas (tarea 6.2)
//
// Funciones puras: no mutan el `estado` de entrada. Ante una acción inválida
// devuelven `{ ok: false, error }` y el estado original permanece intacto
// (criterios 5.5, 6.2, 6.5). Conservan el invariante de que cada combinación
// (color, estrella) aparece exactamente una vez entre el centro y las
// posesiones, y que ningún Jugador posee dos Fichas del mismo color.
//
// _Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8_

/** Construye un resultado de error de Fichas con el código y mensaje dados. */
function errorFichas(
  codigo: 'FICHA_NO_DISPONIBLE' | 'FICHA_COLOR_DUPLICADO' | 'FICHA_FUERA_DE_RANGO',
  mensaje: string,
): ResultadoFichas {
  return { ok: false, error: { codigo, mensaje } };
}

/** Clona en profundidad el centro de un estado de Fichas. */
function clonarCentro(estado: EstadoFichas): Ficha[] {
  return estado.centro.map((ficha) => ({ ...ficha }));
}

/** Clona en profundidad el mapa de posesiones por Jugador. */
function clonarPorJugador(estado: EstadoFichas): Record<string, Ficha[]> {
  const copia: Record<string, Ficha[]> = {};
  for (const [jugadorId, fichas] of Object.entries(estado.porJugador)) {
    copia[jugadorId] = fichas.map((ficha) => ({ ...ficha }));
  }
  return copia;
}

/** Devuelve las Fichas en posesión de un Jugador (lista vacía si no tiene). */
function fichasDe(estado: EstadoFichas, jugadorId: string): readonly Ficha[] {
  return estado.porJugador[jugadorId] ?? [];
}

/** True si el Jugador ya posee al menos una Ficha del color indicado. */
function poseeColor(
  estado: EstadoFichas,
  jugadorId: string,
  color: ColorFicha,
): boolean {
  return fichasDe(estado, jugadorId).some((ficha) => ficha.color === color);
}

/** Índice de la Ficha (color, estrellas) en el centro, o -1 si no está. */
function indiceEnCentro(estado: EstadoFichas, ficha: Ficha): number {
  return estado.centro.findIndex(
    (f) => f.color === ficha.color && f.estrellas === ficha.estrellas,
  );
}

/**
 * Toma una Ficha disponible del color activo del centro y la asigna al Jugador.
 *
 * Rechaza, conservando el estado, si: las estrellas están fuera del rango 1..N
 * (`FICHA_FUERA_DE_RANGO`), el color no es el de la Ronda activa o la Ficha no
 * está disponible en el centro (`FICHA_NO_DISPONIBLE`), o el Jugador ya posee
 * una Ficha de ese color (`FICHA_COLOR_DUPLICADO`).
 *
 * @param estado Estado actual de las Fichas (no se muta).
 * @param jugadorId Identificador del Jugador que toma la Ficha.
 * @param ficha Ficha que se desea tomar (color y estrellas).
 * @returns Nuevo estado con la Ficha asignada al Jugador, o un error de juego.
 * _Requirements: 5.5, 6.1, 6.2_
 */
export function tomar(
  estado: EstadoFichas,
  jugadorId: string,
  ficha: Ficha,
): ResultadoFichas {
  if (ficha.estrellas < 1 || ficha.estrellas > estado.numJugadores) {
    return errorFichas(
      'FICHA_FUERA_DE_RANGO',
      `La ficha de ${ficha.estrellas} estrellas no está en el botín de esta operación.`,
    );
  }
  if (ficha.color !== estado.colorActivo) {
    return errorFichas(
      'FICHA_NO_DISPONIBLE',
      'Esa ficha pertenece a otra fase del golpe y no está disponible.',
    );
  }
  if (poseeColor(estado, jugadorId, ficha.color)) {
    return errorFichas(
      'FICHA_COLOR_DUPLICADO',
      'Ya tienes una ficha de este color; no puedes quedarte con dos.',
    );
  }
  const indice = indiceEnCentro(estado, ficha);
  if (indice === -1) {
    return errorFichas(
      'FICHA_NO_DISPONIBLE',
      'Esa ficha ya no está sobre la mesa; alguien se te adelantó.',
    );
  }

  const centro = clonarCentro(estado);
  const tomada = centro.splice(indice, 1)[0]!;
  const porJugador = clonarPorJugador(estado);
  porJugador[jugadorId] = [...(porJugador[jugadorId] ?? []), tomada];

  return { ok: true, estado: { ...estado, centro, porJugador } };
}

/**
 * Intercambia la Ficha del color activo que posee el Jugador por otra Ficha
 * disponible del mismo color en el centro: devuelve la suya al centro y toma
 * `fichaCentro`.
 *
 * Rechaza, conservando el estado, si: `fichaCentro` está fuera de rango
 * (`FICHA_FUERA_DE_RANGO`), no es del color activo, el Jugador no posee una
 * Ficha del color activo que devolver, o `fichaCentro` no está disponible en el
 * centro (`FICHA_NO_DISPONIBLE`).
 *
 * @param estado Estado actual de las Fichas (no se muta).
 * @param jugadorId Identificador del Jugador que intercambia.
 * @param fichaCentro Ficha del centro que el Jugador desea tomar.
 * @returns Nuevo estado tras el intercambio, o un error de juego.
 * _Requirements: 6.3, 6.5_
 */
export function intercambiarConCentro(
  estado: EstadoFichas,
  jugadorId: string,
  fichaCentro: Ficha,
): ResultadoFichas {
  if (fichaCentro.estrellas < 1 || fichaCentro.estrellas > estado.numJugadores) {
    return errorFichas(
      'FICHA_FUERA_DE_RANGO',
      `La ficha de ${fichaCentro.estrellas} estrellas no está en el botín de esta operación.`,
    );
  }
  if (fichaCentro.color !== estado.colorActivo) {
    return errorFichas(
      'FICHA_NO_DISPONIBLE',
      'Esa ficha pertenece a otra fase del golpe y no está disponible.',
    );
  }

  const propias = fichasDe(estado, jugadorId);
  const indicePropia = propias.findIndex(
    (f) => f.color === estado.colorActivo,
  );
  if (indicePropia === -1) {
    return errorFichas(
      'FICHA_NO_DISPONIBLE',
      'No tienes una ficha de este color que puedas intercambiar.',
    );
  }

  const indiceCentro = indiceEnCentro(estado, fichaCentro);
  if (indiceCentro === -1) {
    return errorFichas(
      'FICHA_NO_DISPONIBLE',
      'Esa ficha ya no está sobre la mesa; alguien se te adelantó.',
    );
  }

  const centro = clonarCentro(estado);
  const porJugador = clonarPorJugador(estado);
  const tomada = centro.splice(indiceCentro, 1)[0]!;
  const nuevasPropias = [...(porJugador[jugadorId] ?? [])];
  const devuelta = nuevasPropias[indicePropia]!;
  nuevasPropias[indicePropia] = tomada;
  porJugador[jugadorId] = nuevasPropias;
  centro.push(devuelta);

  return { ok: true, estado: { ...estado, centro, porJugador } };
}

/**
 * Intercambia entre dos Jugadores sus Fichas del color indicado: cada uno queda
 * en posesión de la Ficha que antes tenía el otro.
 *
 * Rechaza, conservando el estado, si alguno de los dos Jugadores no posee una
 * Ficha de ese color (`FICHA_NO_DISPONIBLE`).
 *
 * @param estado Estado actual de las Fichas (no se muta).
 * @param jugadorA Identificador del primer Jugador.
 * @param jugadorB Identificador del segundo Jugador.
 * @param color Color de las Fichas que se intercambian.
 * @returns Nuevo estado tras la permuta, o un error de juego.
 * _Requirements: 6.4, 6.5_
 */
export function intercambiarConJugador(
  estado: EstadoFichas,
  jugadorA: string,
  jugadorB: string,
  color: ColorFicha,
): ResultadoFichas {
  const fichasA = fichasDe(estado, jugadorA);
  const fichasB = fichasDe(estado, jugadorB);
  const indiceA = fichasA.findIndex((f) => f.color === color);
  const indiceB = fichasB.findIndex((f) => f.color === color);

  if (indiceA === -1 || indiceB === -1) {
    return errorFichas(
      'FICHA_NO_DISPONIBLE',
      'Alguno de los dos ya no tiene una ficha de este color para intercambiar.',
    );
  }

  const porJugador = clonarPorJugador(estado);
  const propiasA = [...(porJugador[jugadorA] ?? [])];
  const propiasB = [...(porJugador[jugadorB] ?? [])];
  const fichaA = propiasA[indiceA]!;
  const fichaB = propiasB[indiceB]!;
  propiasA[indiceA] = fichaB;
  propiasB[indiceB] = fichaA;
  porJugador[jugadorA] = propiasA;
  porJugador[jugadorB] = propiasB;

  return { ok: true, estado: { ...estado, porJugador } };
}

/**
 * Indica si cada uno de los Jugadores dados posee exactamente una Ficha del
 * color indicado. Sirve para habilitar el avance de Ronda o el Showdown cuando
 * todos completaron su Ficha del color activo (criterio 6.8).
 *
 * @param estado Estado actual de las Fichas.
 * @param color Color que se comprueba.
 * @param jugadores Identificadores de los Jugadores a verificar.
 * @returns True si todos poseen exactamente una Ficha de ese color.
 * _Requirements: 6.8_
 */
export function todosTienenFichaDelColor(
  estado: EstadoFichas,
  color: ColorFicha,
  jugadores: string[],
): boolean {
  return jugadores.every(
    (jugadorId) =>
      fichasDe(estado, jugadorId).filter((f) => f.color === color).length === 1,
  );
}
