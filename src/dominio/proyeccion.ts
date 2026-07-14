// Proyección de vistas por Jugador y privacidad de las Cartas de Bolsillo
// (lógica pura, sin I/O).
//
// El Servidor_Local es la única fuente de verdad del estado de la Partida, pero
// nunca debe filtrar información privada a clientes ajenos. Este módulo proyecta
// el `EstadoPartida` autoritativo a una VISTA personalizada para un Jugador
// concreto: oculta las Cartas de Bolsillo del resto de Jugadores mientras el
// Golpe en curso no haya llegado al Showdown y las revela todas en el Showdown.
//
// También expone `solicitarCartasDe`, que aplica la regla de privacidad ante una
// solicitud explícita de las Cartas de Bolsillo de otro Jugador: antes del
// Showdown la solicitud se rechaza con `ACCION_NO_PERMITIDA` sin revelar valores.
//
// Funciones puras: no mutan el estado recibido y devuelven objetos nuevos.
//
// _Requirements: 4.2, 4.6, 4.7, 10.3, 10.4_

import {
  type AjustesPartida,
  type Carta,
  type EntradaHistorialGolpe,
  type ErrorJuego,
  type EstadoFichas,
  type EstadoPartida,
  type FasePartida,
  type Jugador,
  type MensajeChat,
  type ResultadoGolpeReciente,
  type ResultadoPartida,
  type Ronda,
  type SnapshotShowdownResuelto,
  type TerminacionPorDesconexion,
} from "./modelos";
import { ordenJugadoresShowdown } from "./showdown";

// ===========================================================================
// Tipos de vista
// ===========================================================================

/**
 * Marcador que ocupa el lugar de las Cartas de Bolsillo de otro Jugador cuando
 * éstas están ocultas (antes del Showdown). Nunca contiene valores de cartas,
 * de modo que la vista no puede filtrar información privada.
 */
export const BOLSILLO_OCULTO = "OCULTO" as const;

/**
 * Identificador de perspectiva para clientes conectados al servidor que aún no
 * se han unido a la Partida. Permite difundir el estado público del Lobby.
 */
export const PERSPECTIVA_INVITADO = "__invitado__" as const;

/**
 * Valor del campo `bolsillo` en una vista:
 * - una tupla de dos Cartas cuando el Jugador es el propio o ya es Showdown,
 * - `null` cuando aún no se han repartido las Cartas de Bolsillo,
 * - `'OCULTO'` cuando pertenecen a otro Jugador y el Golpe no ha llegado al
 *   Showdown (las cartas ajenas no aparecen).
 */
export type BolsilloVisible = [Carta, Carta] | null | typeof BOLSILLO_OCULTO;

/** Proyección de un Jugador en la vista personalizada de otro (o de sí mismo). */
export interface JugadorVisible {
  /** Identificador del Jugador. */
  id: string;
  /** Nombre registrado del Jugador. */
  nombre: string;
  /** Leyenda del alias para tooltip, si existe. */
  descripcion?: string;
  /** Cartas de Bolsillo visibles, ocultas o aún no repartidas. */
  bolsillo: BolsilloVisible;
  /** Indica si el Jugador tiene una conexión activa con el Servidor_Local. */
  conectado: boolean;
}

/** Proyección de un espectador en la vista de la Partida. */
export interface EspectadorVisible {
  id: string;
  nombre: string;
  descripcion?: string;
  conectado: boolean;
}

/**
 * Proyección del Golpe en curso para una vista. Deliberadamente NO incluye la
 * `baraja` (mazo restante): exponerla permitiría anticipar cartas futuras, así
 * que el mazo nunca se envía a los clientes.
 */
export interface VistaGolpe {
  /** Número de Golpe, en el rango 1..5. */
  numero: number;
  /** Ronda activa del Golpe. */
  ronda: Ronda;
  /** Cartas Comunitarias reveladas (0..5), visibles para todos. */
  comunitarias: Carta[];
  /** Estado de las Fichas del Golpe (información pública). */
  fichas: EstadoFichas;
  /** Ids de los jugadores que han confirmado su ficha en la ronda actual. */
  confirmados: string[];
  /** Cuántos jugadores del orden de showdown ya revelaron mano (0..N). */
  reveladoShowdown: number;
  /** Orden de revelado: ids ascendente por Ficha roja. */
  ordenShowdown: string[];
  /** Marca de tiempo (epoch ms) en que expira el temporizador de avance, o null. */
  temporizadorFinAt?: number | null;
}

/**
 * Vista personalizada del estado de la Partida desde la perspectiva de un
 * Jugador concreto. Es un objeto nuevo derivado del `EstadoPartida` autoritativo
 * en el que las Cartas de Bolsillo ajenas se ocultan antes del Showdown.
 *
 * No incluye la `semilla` del barajado (información sensible que permitiría
 * predecir el reparto) ni el mazo restante.
 */
export interface VistaPartida {
  /** Fase actual de la Partida. */
  fase: FasePartida;
  /** Identificador del Jugador desde cuya perspectiva se construye la vista. */
  perspectivaJugadorId: string;
  /** Jugadores de la Partida con sus Cartas de Bolsillo proyectadas. */
  jugadores: JugadorVisible[];
  /** Golpe en curso proyectado, o null en LOBBY/FINALIZADA. */
  golpeActual: VistaGolpe | null;
  /** Número de Golpes ya jugados (0..5). */
  golpesJugados: number;
  /** Bóvedas doradas acumuladas (0..3). */
  bovedasDoradas: number;
  /** Alarmas rojas acumuladas (0..3). */
  alarmasRojas: number;
  /** Resultado final de la Partida, o null si no ha finalizado. */
  resultado: ResultadoPartida | null;
  /** Ajustes del modo de juego (visibles para que el cliente los muestre). */
  ajustes?: AjustesPartida;
  /** Id del Jugador anfitrión (el que creó la partida / primer jugador). */
  anfitrionId?: string | undefined;
  /** Espectadores conectados a la Partida. */
  espectadores: EspectadorVisible[];
  /** Indica si la perspectiva actual es un espectador (no juega). */
  esEspectador: boolean;
  /** Golpes resueltos con su resultado. */
  historialGolpes: EntradaHistorialGolpe[];
  /** Showdowns resueltos con cartas y manos visibles para consulta histórica. */
  historialShowdowns: VistaShowdownResuelto[];
  /** Resultado del último Golpe resuelto (banner). */
  ultimoResultadoGolpe: ResultadoGolpeReciente | null;
  /** Showdown recién resuelto con cartas reveladas, o null. */
  ultimoShowdownResuelto: VistaShowdownResuelto | null;
  /** Cuenta atrás por desconexión de un ladrón, o null. */
  terminacionPorDesconexion: TerminacionPorDesconexion | null;
  /** Historial de mensajes del chat de la Partida. */
  historialChat: MensajeChat[];
}

/** Vista del Showdown ya resuelto (persiste hasta movimiento de fichas). */
export interface VistaShowdownResuelto {
  numero: number;
  exito: boolean;
  comunitarias: Carta[];
  fichas: EstadoFichas;
  jugadores: JugadorVisible[];
}

// ===========================================================================
// Resultado de solicitud de cartas
// ===========================================================================

/** Resultado de solicitar las Cartas de Bolsillo de un Jugador. */
export type ResultadoSolicitudCartas =
  | { ok: true; bolsillo: [Carta, Carta] | null }
  | { ok: false; error: ErrorJuego };

// ===========================================================================
// Privacidad: ¿están reveladas las Cartas de Bolsillo?
// ===========================================================================

/**
 * Indica si las Cartas de Bolsillo de TODOS los Jugadores están reveladas en el
 * Showdown progresivo (todas las manos del orden ya fueron mostradas).
 */
export function bolsillosRevelados(estado: EstadoPartida): boolean {
  const golpe = estado.golpeActual;
  if (golpe === null || golpe.ronda !== "SHOWDOWN") {
    return false;
  }
  return golpe.reveladoShowdown >= estado.jugadores.length;
}

/** Ids de jugadores cuyo bolsillo ya fue revelado en el Showdown en curso. */
function idsBolsillosRevelados(estado: EstadoPartida): ReadonlySet<string> {
  const golpe = estado.golpeActual;
  if (
    golpe === null ||
    golpe.ronda !== "SHOWDOWN" ||
    golpe.reveladoShowdown === 0
  ) {
    return new Set();
  }
  const orden = ordenJugadoresShowdown(estado.jugadores, golpe.fichas);
  return new Set(orden.slice(0, golpe.reveladoShowdown));
}

// ===========================================================================
// Proyección
// ===========================================================================

/**
 * Copia defensiva de unas Cartas de Bolsillo, para que la vista no comparta
 * referencias de arrays con el estado autoritativo.
 */
function copiarBolsillo(bolsillo: [Carta, Carta]): [Carta, Carta] {
  return [bolsillo[0], bolsillo[1]];
}

/**
 * Proyecta un Jugador a su forma visible desde la perspectiva de `jugadorId`.
 *
 * El propio Jugador siempre ve sus Cartas de Bolsillo. Los espectadores ven
 * todas las manos en todo momento. Las de los demás jugadores se revelan cuando
 * su id está en el conjunto de bolsillos ya revelados en el Showdown progresivo;
 * en caso contrario se sustituyen por {@link BOLSILLO_OCULTO}.
 */
function proyectarJugador(
  jugador: Jugador,
  perspectivaJugadorId: string,
  idsRevelados: ReadonlySet<string>,
  esEspectador: boolean,
): JugadorVisible {
  const esPropio = jugador.id === perspectivaJugadorId;
  let bolsillo: BolsilloVisible;

  if (jugador.bolsillo === null) {
    // Aún no se han repartido cartas: no hay nada que ocultar ni revelar.
    bolsillo = null;
  } else if (esEspectador || esPropio || idsRevelados.has(jugador.id)) {
    bolsillo = copiarBolsillo(jugador.bolsillo);
  } else {
    bolsillo = BOLSILLO_OCULTO;
  }

  return {
    id: jugador.id,
    nombre: jugador.nombre,
    ...(jugador.descripcion !== undefined
      ? { descripcion: jugador.descripcion }
      : {}),
    bolsillo,
    conectado: true,
  };
}

function proyectarSnapshotShowdown(
  snap: SnapshotShowdownResuelto,
  jugadoresEstado: readonly Jugador[],
): VistaShowdownResuelto {
  const jugadores: JugadorVisible[] = jugadoresEstado.map((jugador) => ({
    id: jugador.id,
    nombre: jugador.nombre,
    ...(jugador.descripcion !== undefined
      ? { descripcion: jugador.descripcion }
      : {}),
    bolsillo: snap.bolsillosRevelados[jugador.id] ?? null,
    conectado: true,
  }));
  return {
    numero: snap.numero,
    exito: snap.exito,
    comunitarias: [...snap.comunitarias],
    fichas: snap.fichas,
    jugadores,
  };
}

function proyectarShowdownResuelto(
  estado: EstadoPartida,
): VistaShowdownResuelto | null {
  const snap = estado.ultimoShowdownResuelto ?? null;
  if (snap === null) {
    return null;
  }
  return proyectarSnapshotShowdown(snap, estado.jugadores);
}

/**
 * Proyecta la vista pública del Lobby para un cliente que aún no se ha unido.
 * Incluye la lista de miembros y espectadores sin información privada.
 */
export function proyectarVistaInvitado(
  estado: EstadoPartida,
  temporizadorFinAt: number | null = null,
): VistaPartida {
  return proyectarEstadoPara(estado, PERSPECTIVA_INVITADO, temporizadorFinAt);
}

/**
 * Proyecta el `EstadoPartida` autoritativo a la VISTA personalizada de un
 * Jugador.
 *
 * - Las Cartas de Bolsillo del propio Jugador siempre son visibles.
 * - Las Cartas de Bolsillo de los demás Jugadores se ocultan
 *   ({@link BOLSILLO_OCULTO}) mientras el Golpe en curso no esté en SHOWDOWN
 *   (criterios 4.2, 4.6).
 * - En el Showdown se revelan las Cartas de Bolsillo de TODOS los Jugadores
 *   (criterio 10.3).
 *
 * La función es pura: no muta `estado` y devuelve un objeto nuevo. La vista
 * omite deliberadamente el mazo restante y la semilla para no filtrar
 * información que permita anticipar cartas.
 *
 * @param estado Estado autoritativo de la Partida.
 * @param jugadorId Identificador del Jugador desde cuya perspectiva se proyecta.
 * @returns Vista personalizada de la Partida.
 */
export function proyectarEstadoPara(
  estado: EstadoPartida,
  jugadorId: string,
  temporizadorFinAt: number | null = null,
): VistaPartida {
  const idsRevelados = idsBolsillosRevelados(estado);
  const listaEspectadores = estado.espectadores ?? [];
  const esEspectador = listaEspectadores.some((e) => e.id === jugadorId);

  const jugadores = estado.jugadores.map((jugador) =>
    proyectarJugador(jugador, jugadorId, idsRevelados, esEspectador),
  );

  const espectadores: EspectadorVisible[] = listaEspectadores.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    ...(e.descripcion !== undefined ? { descripcion: e.descripcion } : {}),
    conectado: true,
  }));

  const golpeActual: VistaGolpe | null =
    estado.golpeActual === null
      ? null
      : {
          numero: estado.golpeActual.numero,
          ronda: estado.golpeActual.ronda,
          comunitarias: [...estado.golpeActual.comunitarias],
          fichas: estado.golpeActual.fichas,
          confirmados: [...estado.golpeActual.confirmados],
          reveladoShowdown: estado.golpeActual.reveladoShowdown,
          ordenShowdown:
            estado.golpeActual.ronda === "SHOWDOWN"
              ? ordenJugadoresShowdown(
                  estado.jugadores,
                  estado.golpeActual.fichas,
                )
              : [],
          temporizadorFinAt,
        };

  return {
    fase: estado.fase,
    perspectivaJugadorId: jugadorId,
    jugadores,
    espectadores,
    esEspectador,
    golpeActual,
    golpesJugados: estado.golpesJugados,
    bovedasDoradas: estado.bovedasDoradas,
    alarmasRojas: estado.alarmasRojas,
    resultado: estado.resultado,
    historialGolpes: [...(estado.historialGolpes ?? [])],
    historialShowdowns: (estado.historialShowdowns ?? []).map((snap) =>
      proyectarSnapshotShowdown(snap, estado.jugadores),
    ),
    ultimoResultadoGolpe: estado.ultimoResultadoGolpe ?? null,
    ultimoShowdownResuelto: proyectarShowdownResuelto(estado),
    terminacionPorDesconexion: estado.terminacionPorDesconexion ?? null,
    historialChat: (estado.historialChat ?? []).map((mensaje) => ({
      ...mensaje,
    })),
    ...(estado.ajustes !== undefined ? { ajustes: estado.ajustes } : {}),
  };
}

/**
 * Enriquece una vista proyectada con el estado de conexión de cada Jugador.
 *
 * El dominio puro no conoce las sesiones WebSocket; la capa de transporte
 * construye un mapa `jugadorId → conectado` desde el Gestor de Sesiones y lo
 * aplica aquí antes de difundir la vista a los clientes.
 *
 * @param vista Vista personalizada base.
 * @param conexionPorJugador Mapa de conexión por identificador de Jugador.
 * @returns Vista con el campo `conectado` actualizado en cada Jugador.
 */
export function aplicarEstadoConexion(
  vista: VistaPartida,
  conexionPorJugador: ReadonlyMap<string, boolean>,
): VistaPartida {
  return {
    ...vista,
    jugadores: vista.jugadores.map((jugador) => ({
      ...jugador,
      conectado: conexionPorJugador.get(jugador.id) ?? jugador.conectado,
    })),
    historialShowdowns: vista.historialShowdowns.map((showdown) => ({
      ...showdown,
      jugadores: showdown.jugadores.map((jugador) => ({
        ...jugador,
        conectado: conexionPorJugador.get(jugador.id) ?? jugador.conectado,
      })),
    })),
    espectadores: vista.espectadores.map((espectador) => ({
      ...espectador,
      conectado: conexionPorJugador.get(espectador.id) ?? espectador.conectado,
    })),
    ultimoShowdownResuelto:
      vista.ultimoShowdownResuelto === null
        ? null
        : {
            ...vista.ultimoShowdownResuelto,
            jugadores: vista.ultimoShowdownResuelto.jugadores.map(
              (jugador) => ({
                ...jugador,
                conectado:
                  conexionPorJugador.get(jugador.id) ?? jugador.conectado,
              }),
            ),
          },
  };
}

// ===========================================================================
// Solicitud explícita de Cartas de Bolsillo
// ===========================================================================

/**
 * Resuelve una solicitud de las Cartas de Bolsillo de un Jugador.
 *
 * - Si el solicitante pide su propio bolsillo, se devuelve siempre.
 * - Si pide el de otro Jugador y el Golpe está en SHOWDOWN, se devuelve
 *   (criterio 10.3).
 * - Si pide el de otro Jugador antes del Showdown, se RECHAZA con
 *   `ACCION_NO_PERMITIDA` y la respuesta NO incluye las cartas (criterios 4.7,
 *   10.4).
 *
 * Función pura: no muta el estado.
 *
 * @param estado Estado autoritativo de la Partida.
 * @param solicitanteId Identificador del Jugador que solicita.
 * @param objetivoId Identificador del Jugador cuyas cartas se solicitan.
 * @returns Las Cartas de Bolsillo o un error que no revela valores.
 */
export function solicitarCartasDe(
  estado: EstadoPartida,
  solicitanteId: string,
  objetivoId: string,
): ResultadoSolicitudCartas {
  const esPropio = solicitanteId === objetivoId;
  const esEspectador = (estado.espectadores ?? []).some(
    (e) => e.id === solicitanteId,
  );
  const idsRevelados = idsBolsillosRevelados(estado);

  if (!esPropio && !esEspectador && !idsRevelados.has(objetivoId)) {
    return {
      ok: false,
      error: {
        codigo: "ACCION_NO_PERMITIDA",
        mensaje:
          "No está permitido mirar las Cartas de Bolsillo de otro miembro de la banda antes del Showdown.",
      },
    };
  }

  const objetivo = estado.jugadores.find((j) => j.id === objetivoId);
  if (objetivo === undefined) {
    return {
      ok: false,
      error: {
        codigo: "ACCION_NO_PERMITIDA",
        mensaje: "No se encontró a ese miembro de la banda en la Partida.",
      },
    };
  }

  return {
    ok: true,
    bolsillo:
      objetivo.bolsillo === null ? null : copiarBolsillo(objetivo.bolsillo),
  };
}
