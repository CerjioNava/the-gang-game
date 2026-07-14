// Coordinador de Partida (capa de orquestación del Servidor_Local).
//
// El Coordinador es el dueño del ESTADO AUTORITATIVO de la Partida: la única
// fuente de verdad. Recibe mensajes ya validados como `MensajeEntrante`
// (tipo + payload) asociados a un `jugadorId` (la identidad estable que el
// gestor de sesiones —tarea 13.2— resuelve a partir del `sessionId`) y los
// traduce a operaciones del dominio:
//
//   - Operaciones de Lobby: registrar/abandonar Jugador, iniciar la Partida
//     (módulo `lobby` + `iniciarPartida`).
//   - Acciones del Motor_Juego: AVANZAR, RESOLVER_SHOWDOWN, TOMAR_FICHA,
//     INTERCAMBIAR_CENTRO, INTERCAMBIAR_JUGADOR (módulo `motorJuego`).
//   - Solicitudes privadas: consultar Cartas de Bolsillo (módulo `proyeccion`).
//
// Reglas clave de este coordinador (criterios 4.7, 10.4 y "Error Handling" del
// diseño):
//   - Cuando una acción es inválida, el dominio devuelve `{ ok: false, error }`.
//     El Coordinador NO muta el estado autoritativo y devuelve el error SOLO al
//     emisor (resultado `ERROR`), sin difundirlo a los demás clientes.
//   - Cuando una acción es válida, actualiza el estado autoritativo interno y
//     señala que procede DIFUNDIR las vistas personalizadas a todos los
//     clientes (resultado `DIFUNDIR`). El Coordinador NO implementa el broadcast
//     en sí (tarea 14.2): solo expone `obtenerVistaPara` para que el Difusor lo
//     use.
//   - Las solicitudes de Cartas de Bolsillo ajenas antes del Showdown se
//     rechazan con `ACCION_NO_PERMITIDA` sin filtrar valores (vía
//     `solicitarCartasDe`).
//
// El Coordinador está deliberadamente DESACOPLADO de `ws`: no conoce sockets ni
// HTTP. Trabaja con identidades (`jugadorId`) y mensajes JSON abstractos, lo que
// lo hace puramente testeable.
//
// _Requirements: 4.7, 10.4_

import {
  aplicarAccion,
  iniciarPartida,
  type Accion,
} from "../dominio/motorJuego";
import {
  abandonarEspectador,
  abandonarJugador,
  actualizarIdentidadJugador,
  aplicarTerminacionPorDesconexionExpirada,
  cancelarTerminacionPorDesconexion,
  generarNombreEspectador,
  iniciarTerminacionPorDesconexion,
  registrarEspectador,
  registrarJugador,
  validarInicioConConectividad,
  volverAlLobby,
} from "../dominio/lobby";
import {
  proyectarEstadoPara,
  proyectarVistaInvitado,
  solicitarCartasDe,
  type VistaPartida,
} from "../dominio/proyeccion";
import {
  type ColorFicha,
  type ErrorJuego,
  type EstadoPartida,
  type EventoJuego,
  type Ficha,
  type MensajeChat,
  type Semilla,
  type AjustesPartida,
  AJUSTES_POR_DEFECTO,
} from "../dominio/modelos";
import { agregarMensajeChat, sanearTextoChat } from "../dominio/chat";
import { randomUUID } from "node:crypto";
import { type MensajeEntrante, type MensajeSaliente } from "./tipos";

// ===========================================================================
// Protocolo de mensajes (tipo)
// ===========================================================================

/**
 * Tipos de mensaje ENTRANTE que el Coordinador entiende (cliente → servidor).
 * Cualquier otro `tipo` se considera desconocido y produce un resultado
 * `IGNORADO` con un error genérico solo al emisor.
 */
export const MensajeCliente = {
  /** Registrarse en el Lobby o como espectador. payload: `{ nombre: string, rol?: 'JUGADOR' | 'ESPECTADOR' }`. */
  UNIRSE: "UNIRSE",
  /** Abandonar el Lobby antes del inicio. payload: ninguno. */
  ABANDONAR: "ABANDONAR",
  /** Expulsar a un miembro (solo en LOBBY). payload: `{ jugadorId: string }`. */
  EXPULSAR: "EXPULSAR",
  /** Cambiar alias/descripción en LOBBY. payload: `{ nombre: string, descripcion?: string }`. */
  CAMBIAR_ALIAS: "CAMBIAR_ALIAS",
  /** Iniciar la Partida (requiere 3..6 Jugadores conectados). payload: ninguno. */
  INICIAR: "INICIAR",
  /** Configurar ajustes del modo de juego (solo en LOBBY). payload: `{ sinKickers: boolean }`. */
  CONFIGURAR_AJUSTES: "CONFIGURAR_AJUSTES",
  /** Avanzar de Ronda o iniciar el Showdown. payload: ninguno. */
  AVANZAR: "AVANZAR",
  /** Resolver el Showdown del Golpe. payload: ninguno. */
  RESOLVER_SHOWDOWN: "RESOLVER_SHOWDOWN",
  REVELAR_SHOWDOWN: "REVELAR_SHOWDOWN",
  /** Terminar la Partida y volver al Lobby (solo anfitrión). payload: ninguno. */
  TERMINAR_PARTIDA: "TERMINAR_PARTIDA",
  /** Tomar una Ficha del centro. payload: `{ ficha: Ficha }`. */
  TOMAR_FICHA: "TOMAR_FICHA",
  /** Intercambiar la Ficha propia por una del centro. payload: `{ fichaCentro: Ficha }`. */
  INTERCAMBIAR_CENTRO: "INTERCAMBIAR_CENTRO",
  /** Intercambiar la Ficha propia con otro Jugador. payload: `{ jugadorB: string }`. */
  INTERCAMBIAR_JUGADOR: "INTERCAMBIAR_JUGADOR",
  /** Solicitar las Cartas de Bolsillo de un Jugador. payload: `{ objetivoId: string }`. */
  SOLICITAR_CARTAS: "SOLICITAR_CARTAS",
  /** Enviar un mensaje al chat de la Partida (solo jugadores). payload: `{ texto: string }`. */
  ENVIAR_CHAT: "ENVIAR_CHAT",
} as const;

/**
 * Tipos de mensaje SALIENTE privados que el Coordinador genera para el emisor.
 * El estado completo se difunde como vistas mediante el Difusor (tarea 14.2),
 * por lo que aquí solo aparecen respuestas dirigidas al emisor.
 */
export const MensajeServidor = {
  /** Error de juego o mensaje genérico dirigido solo al emisor. */
  ERROR: "ERROR",
  /** Respuesta a una solicitud de Cartas de Bolsillo. */
  CARTAS: "CARTAS",
} as const;

// ===========================================================================
// Resultado del procesamiento de un mensaje
// ===========================================================================

/**
 * Resultado de procesar un mensaje entrante. Es la instrucción que el
 * Coordinador entrega a la capa de transporte / Difusor:
 *
 * - `DIFUNDIR`: el estado autoritativo cambió. El Difusor debe enviar a cada
 *   cliente conectado su vista personalizada (`obtenerVistaPara`). `eventos`
 *   describe lo ocurrido para notificaciones opcionales del cliente.
 * - `ERROR`: error de juego. Se envía SOLO al emisor; el estado no cambió.
 * - `PRIVADO`: respuesta dirigida SOLO al emisor (p. ej. sus Cartas de
 *   Bolsillo). El estado no cambió.
 * - `IGNORADO`: el mensaje era malformado o de tipo desconocido. Se responde un
 *   error genérico SOLO al emisor; el estado no cambió.
 */
export type ResultadoCoordinador =
  | { clase: "DIFUNDIR"; eventos: EventoJuego[]; sesionesARetirar?: string[] }
  | { clase: "ERROR"; error: ErrorJuego }
  | { clase: "PRIVADO"; mensaje: MensajeSaliente }
  | { clase: "IGNORADO"; error: ErrorJuego };

/** Contexto de transporte que el Coordinador necesita para algunas operaciones. */
export interface ContextoCoordinador {
  /** Mapa jugadorId → conectado, construido desde el Gestor de Sesiones. */
  conexionPorJugador?: ReadonlyMap<string, boolean>;
}

/** Opciones de configuración del Coordinador. */
export interface OpcionesCoordinador {
  /**
   * Generador de la semilla de barajado usada al iniciar la Partida. Inyectable
   * para hacer las pruebas deterministas. Por defecto deriva una semilla del
   * reloj del sistema.
   */
  generarSemilla?: () => Semilla;
}

// ===========================================================================
// Utilidades de validación de payloads
// ===========================================================================

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function esFicha(valor: unknown): valor is Ficha {
  if (!esObjeto(valor)) {
    return false;
  }
  const color = valor["color"];
  const estrellas = valor["estrellas"];
  const coloresValidos: readonly ColorFicha[] = [
    "BLANCO",
    "AMARILLO",
    "NARANJA",
    "ROJO",
  ];
  return (
    typeof color === "string" &&
    (coloresValidos as readonly string[]).includes(color) &&
    typeof estrellas === "number" &&
    Number.isInteger(estrellas)
  );
}

/** Error genérico para mensajes malformados o de tipo desconocido. */
function errorGenerico(mensaje: string): ErrorJuego {
  return { codigo: "ACCION_NO_PERMITIDA", mensaje };
}

// ===========================================================================
// Coordinador
// ===========================================================================

/**
 * Coordinador de Partida. Mantiene el `EstadoPartida` autoritativo (que arranca
 * en fase LOBBY) y procesa los mensajes/acciones entrantes de cada Jugador.
 *
 * No realiza I/O: la capa de transporte (tarea 13.1/13.2) le entrega mensajes
 * validados y el Difusor (tarea 14.2) consulta las vistas con
 * {@link Coordinador.obtenerVistaPara}.
 */
export class Coordinador {
  /** Estado autoritativo de la Partida. Nunca se muta in situ; se reemplaza. */
  #estado: EstadoPartida;
  readonly #generarSemilla: () => Semilla;
  /** Ajustes del modo de juego configurados en el Lobby. */
  #ajustes: AjustesPartida;
  /** Marca de tiempo (epoch ms) de fin del temporizador de avance de ronda. */
  #temporizadorFinAt: number | null = null;
  /** Id del Jugador anfitrión (el primero en unirse al Lobby). */
  #anfitrionId: string | null = null;

  constructor(opciones: OpcionesCoordinador = {}) {
    this.#generarSemilla = opciones.generarSemilla ?? (() => Date.now());
    this.#estado = Coordinador.#estadoLobbyInicial();
    this.#ajustes = { ...AJUSTES_POR_DEFECTO };
  }

  /** Devuelve el id del anfitrión (el primer jugador registrado en el Lobby). */
  obtenerAnfitrionId(): string | null {
    return this.#anfitrionId;
  }

  /** Fija o limpia el temporizador de avance de ronda proyectado a los clientes. */
  fijarTemporizadorFinAt(finAt: number | null): void {
    this.#temporizadorFinAt = finAt;
  }

  /** Avance automático de ronda (temporizador expirado). */
  avanzarAutomatico(): ResultadoCoordinador {
    return this.#aplicar({ tipo: "AVANZAR_AUTOMATICO" });
  }

  /** Inicia o reinicia la cuenta atrás por desconexión de un ladrón. */
  registrarDesconexionJugador(
    jugadorId: string,
    ahoraMs: number = Date.now(),
  ): ResultadoCoordinador {
    if (this.#estado.fase !== "EN_CURSO") {
      return { clase: "DIFUNDIR", eventos: [] };
    }
    if (!this.#estado.jugadores.some((j) => j.id === jugadorId)) {
      return { clase: "DIFUNDIR", eventos: [] };
    }
    this.#estado = iniciarTerminacionPorDesconexion(
      this.#estado,
      jugadorId,
      ahoraMs,
    );
    return { clase: "DIFUNDIR", eventos: [] };
  }

  /** Cancela la terminación pendiente (p. ej. reconexión a tiempo). */
  cancelarTerminacionPorDesconexion(): ResultadoCoordinador {
    if (this.#estado.terminacionPorDesconexion == null) {
      return { clase: "DIFUNDIR", eventos: [] };
    }
    this.#estado = cancelarTerminacionPorDesconexion(this.#estado);
    return { clase: "DIFUNDIR", eventos: [] };
  }

  /** Ejecuta volver al lobby si expiró la cuenta atrás por desconexión. */
  ejecutarTerminacionPorDesconexionExpirada(
    ahoraMs: number = Date.now(),
  ): ResultadoCoordinador {
    const siguiente = aplicarTerminacionPorDesconexionExpirada(
      this.#estado,
      ahoraMs,
    );
    if (siguiente === this.#estado) {
      return { clase: "DIFUNDIR", eventos: [] };
    }
    this.#temporizadorFinAt = null;
    this.#estado = siguiente;
    return { clase: "DIFUNDIR", eventos: [] };
  }

  /** Construye el estado inicial en fase LOBBY, sin Jugadores ni Golpe. */
  static #estadoLobbyInicial(): EstadoPartida {
    return {
      fase: "LOBBY",
      jugadores: [],
      espectadores: [],
      golpeActual: null,
      golpesJugados: 0,
      bovedasDoradas: 0,
      alarmasRojas: 0,
      resultado: null,
      semilla: 0,
      historialGolpes: [],
      historialShowdowns: [],
      ultimoResultadoGolpe: null,
      historialChat: [],
    };
  }

  /**
   * Devuelve el estado autoritativo actual. Pensado para el Difusor y las
   * pruebas; es la referencia interna (no se debe mutar desde fuera).
   */
  obtenerEstado(): EstadoPartida {
    return this.#estado;
  }

  /**
   * Devuelve la VISTA personalizada del estado para un Jugador, con las Cartas
   * de Bolsillo ajenas ocultas antes del Showdown. El Difusor (tarea 14.2) la
   * usa para enviar a cada cliente su propia vista.
   */
  obtenerVistaPara(jugadorId: string): VistaPartida {
    const vista = proyectarEstadoPara(
      this.#estado,
      jugadorId,
      this.#temporizadorFinAt,
    );
    return { ...vista, anfitrionId: this.#anfitrionId ?? undefined };
  }

  /**
   * Vista pública del Lobby para clientes conectados que aún no se han unido.
   */
  obtenerVistaInvitado(): VistaPartida {
    const vista = proyectarVistaInvitado(this.#estado, this.#temporizadorFinAt);
    return { ...vista, anfitrionId: this.#anfitrionId ?? undefined };
  }

  /**
   * Procesa un mensaje entrante emitido por `jugadorId` (la identidad estable
   * resuelta desde el `sessionId`). Traduce el mensaje a una operación de Lobby,
   * una acción del Motor_Juego o una solicitud privada, y devuelve la
   * instrucción para la capa de transporte / Difusor.
   *
   * Garantías:
   * - Ante una acción inválida no muta el estado autoritativo y devuelve el
   *   error SOLO al emisor (criterios 4.7, 10.4 y "Error Handling").
   * - Ante una acción válida actualiza el estado autoritativo y señala
   *   `DIFUNDIR`.
   */
  procesarMensaje(
    jugadorId: string,
    mensaje: MensajeEntrante,
    contexto: ContextoCoordinador = {},
  ): ResultadoCoordinador {
    if (!esObjeto(mensaje) || typeof mensaje.tipo !== "string") {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Mensaje no reconocido por el Servidor_Local."),
      };
    }

    switch (mensaje.tipo) {
      case MensajeCliente.UNIRSE:
        return this.#unirse(jugadorId, mensaje.payload);
      case MensajeCliente.ABANDONAR:
        return this.#abandonar(jugadorId);
      case MensajeCliente.EXPULSAR: {
        const rechazoExpulsar = this.#rechazarSiEspectador(jugadorId);
        if (rechazoExpulsar !== null) {
          return rechazoExpulsar;
        }
        return this.#expulsar(jugadorId, mensaje.payload);
      }
      case MensajeCliente.CAMBIAR_ALIAS: {
        const rechazoAlias = this.#rechazarSiEspectador(jugadorId);
        if (rechazoAlias !== null) {
          return rechazoAlias;
        }
        return this.#cambiarAlias(jugadorId, mensaje.payload);
      }
      case MensajeCliente.INICIAR: {
        const rechazoIniciar = this.#rechazarSiEspectador(jugadorId);
        if (rechazoIniciar !== null) {
          return rechazoIniciar;
        }
        return this.#iniciar(contexto);
      }
      case MensajeCliente.CONFIGURAR_AJUSTES: {
        const rechazoAjustes = this.#rechazarSiEspectador(jugadorId);
        if (rechazoAjustes !== null) {
          return rechazoAjustes;
        }
        return this.#configurarAjustes(mensaje.payload);
      }
      case MensajeCliente.AVANZAR: {
        const rechazoAvanzar = this.#rechazarSiEspectador(jugadorId);
        if (rechazoAvanzar !== null) {
          return rechazoAvanzar;
        }
        return this.#aplicar({ tipo: "CONFIRMAR", jugadorId });
      }
      case MensajeCliente.REVELAR_SHOWDOWN: {
        const rechazoRevelar = this.#rechazarSiEspectador(jugadorId);
        if (rechazoRevelar !== null) {
          return rechazoRevelar;
        }
        return this.#aplicar({ tipo: "REVELAR_SHOWDOWN" });
      }
      case MensajeCliente.RESOLVER_SHOWDOWN: {
        const rechazoShowdown = this.#rechazarSiEspectador(jugadorId);
        if (rechazoShowdown !== null) {
          return rechazoShowdown;
        }
        return this.#aplicar({ tipo: "RESOLVER_SHOWDOWN" });
      }
      case MensajeCliente.TERMINAR_PARTIDA: {
        const rechazoTerminar = this.#rechazarSiEspectador(jugadorId);
        if (rechazoTerminar !== null) {
          return rechazoTerminar;
        }
        return this.#terminarPartida(jugadorId);
      }
      case MensajeCliente.TOMAR_FICHA: {
        const rechazoTomar = this.#rechazarSiEspectador(jugadorId);
        if (rechazoTomar !== null) {
          return rechazoTomar;
        }
        return this.#tomarFicha(jugadorId, mensaje.payload);
      }
      case MensajeCliente.INTERCAMBIAR_CENTRO: {
        const rechazoCentro = this.#rechazarSiEspectador(jugadorId);
        if (rechazoCentro !== null) {
          return rechazoCentro;
        }
        return this.#intercambiarCentro(jugadorId, mensaje.payload);
      }
      case MensajeCliente.INTERCAMBIAR_JUGADOR: {
        const rechazoJugador = this.#rechazarSiEspectador(jugadorId);
        if (rechazoJugador !== null) {
          return rechazoJugador;
        }
        return this.#intercambiarJugador(jugadorId, mensaje.payload);
      }
      case MensajeCliente.SOLICITAR_CARTAS: {
        const rechazoCartas = this.#rechazarSiEspectador(jugadorId);
        if (rechazoCartas !== null) {
          return rechazoCartas;
        }
        return this.#solicitarCartas(jugadorId, mensaje.payload);
      }
      case MensajeCliente.ENVIAR_CHAT: {
        const rechazoChat = this.#rechazarSiEspectador(jugadorId);
        if (rechazoChat !== null) {
          return rechazoChat;
        }
        return this.#enviarChat(jugadorId, mensaje.payload);
      }
      default:
        return {
          clase: "IGNORADO",
          error: errorGenerico(
            `Tipo de mensaje desconocido: "${mensaje.tipo}".`,
          ),
        };
    }
  }

  // -------------------------------------------------------------------------
  // Operaciones de Lobby
  // -------------------------------------------------------------------------

  #esEspectador(jugadorId: string): boolean {
    return (this.#estado.espectadores ?? []).some((e) => e.id === jugadorId);
  }

  #rechazarSiEspectador(jugadorId: string): ResultadoCoordinador | null {
    if (!this.#esEspectador(jugadorId)) {
      return null;
    }
    return {
      clase: "ERROR",
      error: {
        codigo: "ACCION_NO_PERMITIDA",
        mensaje:
          "Los espectadores solo pueden observar; no pueden realizar esta acción.",
      },
    };
  }

  #unirse(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (this.#estado.fase === "FINALIZADA") {
      return {
        clase: "ERROR",
        error: {
          codigo: "PARTIDA_FINALIZADA",
          mensaje: "El golpe ya terminó: no puedes unirte a esta Partida.",
        },
      };
    }
    if (!esObjeto(payload)) {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Falta un payload válido para unirse."),
      };
    }

    const rol =
      payload["rol"] === "ESPECTADOR"
        ? ("ESPECTADOR" as const)
        : ("JUGADOR" as const);

    if (rol === "ESPECTADOR") {
      const espectadores = this.#estado.espectadores ?? [];
      const nombre =
        typeof payload["nombre"] === "string" &&
        payload["nombre"].trim().length > 0
          ? payload["nombre"]
          : generarNombreEspectador(espectadores, this.#estado.jugadores);
      return this.#unirseEspectador(jugadorId, nombre, payload["descripcion"]);
    }

    if (typeof payload["nombre"] !== "string") {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Falta un nombre válido para unirse."),
      };
    }

    if (this.#estado.fase !== "LOBBY") {
      return {
        clase: "ERROR",
        error: {
          codigo: "PARTIDA_EN_CURSO",
          mensaje:
            "No es posible unirse como jugador: la Partida ya está en marcha.",
        },
      };
    }

    const espectadores = this.#estado.espectadores ?? [];
    const descripcion =
      typeof payload["descripcion"] === "string"
        ? payload["descripcion"]
        : undefined;
    const resultado = registrarJugador(
      this.#estado.jugadores,
      payload["nombre"],
      jugadorId,
      espectadores,
      descripcion,
    );
    if (!resultado.ok) {
      return { clase: "ERROR", error: resultado.error };
    }

    this.#estado = { ...this.#estado, jugadores: resultado.jugadores };

    if (this.#anfitrionId === null) {
      this.#anfitrionId = jugadorId;
    }

    return { clase: "DIFUNDIR", eventos: [] };
  }

  #unirseEspectador(
    jugadorId: string,
    nombre: string,
    descripcionRaw?: unknown,
  ): ResultadoCoordinador {
    if (this.#estado.jugadores.some((j) => j.id === jugadorId)) {
      return {
        clase: "ERROR",
        error: errorGenerico("Ya estás registrado como miembro de la banda."),
      };
    }

    const espectadoresActuales = this.#estado.espectadores ?? [];
    const descripcion =
      typeof descripcionRaw === "string" ? descripcionRaw : undefined;
    const resultado = registrarEspectador(
      espectadoresActuales,
      this.#estado.jugadores,
      nombre,
      jugadorId,
      descripcion,
    );
    if (!resultado.ok) {
      return { clase: "ERROR", error: resultado.error };
    }

    this.#estado = { ...this.#estado, espectadores: resultado.espectadores };
    return { clase: "DIFUNDIR", eventos: [] };
  }

  #abandonar(jugadorId: string): ResultadoCoordinador {
    const espectadores = this.#estado.espectadores ?? [];
    if (espectadores.some((e) => e.id === jugadorId)) {
      const restantes = abandonarEspectador(espectadores, jugadorId);
      this.#estado = { ...this.#estado, espectadores: restantes };
      return { clase: "DIFUNDIR", eventos: [], sesionesARetirar: [jugadorId] };
    }

    if (this.#estado.fase !== "LOBBY") {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje: "No es posible abandonar el Lobby con la Partida en curso.",
        },
      };
    }

    const jugadores = abandonarJugador(this.#estado.jugadores, jugadorId);
    if (jugadores.length === this.#estado.jugadores.length) {
      // El Jugador no estaba registrado: nada cambia, nada que difundir.
      return {
        clase: "ERROR",
        error: errorGenerico("No estabas registrado en el Lobby."),
      };
    }

    this.#estado = { ...this.#estado, jugadores };
    if (this.#anfitrionId === jugadorId) {
      this.#anfitrionId = jugadores[0]?.id ?? null;
    }
    return { clase: "DIFUNDIR", eventos: [], sesionesARetirar: [jugadorId] };
  }

  #expulsar(solicitanteId: string, payload: unknown): ResultadoCoordinador {
    if (this.#estado.fase !== "LOBBY") {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje: "Solo se puede expulsar miembros antes de dar el golpe.",
        },
      };
    }
    const esJugador = this.#estado.jugadores.some(
      (j) => j.id === solicitanteId,
    );
    if (!esJugador) {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje: "Solo los ladrones de la banda pueden expulsar miembros.",
        },
      };
    }
    if (!esObjeto(payload) || typeof payload["jugadorId"] !== "string") {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Falta el miembro que se desea expulsar."),
      };
    }
    const objetivoId = payload["jugadorId"];

    const espectadores = this.#estado.espectadores ?? [];
    const espectadoresTrasExpulsion = abandonarEspectador(
      espectadores,
      objetivoId,
    );
    if (espectadoresTrasExpulsion.length !== espectadores.length) {
      this.#estado = {
        ...this.#estado,
        espectadores: espectadoresTrasExpulsion,
      };
      return { clase: "DIFUNDIR", eventos: [], sesionesARetirar: [objetivoId] };
    }

    if (objetivoId === solicitanteId) {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje:
            "No puedes expulsarte a ti mismo; abandona la banda si quieres marcharte.",
        },
      };
    }

    const jugadores = abandonarJugador(this.#estado.jugadores, objetivoId);
    if (jugadores.length === this.#estado.jugadores.length) {
      return {
        clase: "ERROR",
        error: errorGenerico("Ese miembro no está en la banda."),
      };
    }

    this.#estado = { ...this.#estado, jugadores };
    return { clase: "DIFUNDIR", eventos: [], sesionesARetirar: [objetivoId] };
  }

  #cambiarAlias(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (this.#estado.fase !== "LOBBY") {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje: "Solo puedes cambiar tu alias antes de dar el golpe.",
        },
      };
    }
    if (!esObjeto(payload) || typeof payload["nombre"] !== "string") {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Falta un alias válido para actualizar."),
      };
    }
    const descripcion =
      typeof payload["descripcion"] === "string"
        ? payload["descripcion"]
        : undefined;
    const espectadores = this.#estado.espectadores ?? [];
    const resultado = actualizarIdentidadJugador(
      this.#estado.jugadores,
      espectadores,
      jugadorId,
      payload["nombre"],
      descripcion,
    );
    if (!resultado.ok) {
      return { clase: "ERROR", error: resultado.error };
    }
    this.#estado = { ...this.#estado, jugadores: resultado.jugadores };
    return { clase: "DIFUNDIR", eventos: [] };
  }

  #configurarAjustes(payload: unknown): ResultadoCoordinador {
    if (this.#estado.fase !== "LOBBY") {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje: "Los ajustes solo pueden cambiarse antes de dar el golpe.",
        },
      };
    }
    if (!esObjeto(payload) || typeof payload["sinKickers"] !== "boolean") {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Ajustes inválidos: falta sinKickers (boolean)."),
      };
    }

    this.#ajustes = { sinKickers: payload["sinKickers"] };
    this.#estado = { ...this.#estado, ajustes: this.#ajustes };
    return { clase: "DIFUNDIR", eventos: [] };
  }

  #iniciar(contexto: ContextoCoordinador): ResultadoCoordinador {
    if (this.#estado.fase === "EN_CURSO") {
      return {
        clase: "ERROR",
        error: {
          codigo: "PARTIDA_EN_CURSO",
          mensaje: "La Partida ya está en curso.",
        },
      };
    }
    if (this.#estado.fase === "FINALIZADA") {
      return {
        clase: "ERROR",
        error: {
          codigo: "PARTIDA_FINALIZADA",
          mensaje: "La Partida ya ha finalizado.",
        },
      };
    }

    const conexionPorJugador =
      contexto.conexionPorJugador ?? new Map<string, boolean>();
    const errorInicio = validarInicioConConectividad(
      this.#estado.jugadores,
      conexionPorJugador,
    );
    if (errorInicio !== null) {
      return { clase: "ERROR", error: errorInicio };
    }

    const espectadores = this.#estado.espectadores ?? [];
    this.#estado = {
      ...iniciarPartida(
        this.#estado.jugadores,
        this.#generarSemilla(),
        this.#ajustes,
      ),
      espectadores,
    };
    return {
      clase: "DIFUNDIR",
      eventos: [
        { tipo: "PARTIDA_INICIADA" },
        { tipo: "GOLPE_INICIADO", numero: 1 },
      ],
    };
  }

  #terminarPartida(solicitanteId: string): ResultadoCoordinador {
    if (
      this.#estado.fase !== "EN_CURSO" &&
      this.#estado.fase !== "FINALIZADA"
    ) {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje: "No hay una Partida en curso que terminar.",
        },
      };
    }

    // Abortar una Partida EN_CURSO sigue siendo privilegio del anfitrión.
    // Una vez FINALIZADA (VICTORIA/DERROTA), cualquier jugador puede terminar.
    if (
      this.#estado.fase === "EN_CURSO" &&
      this.#anfitrionId !== solicitanteId
    ) {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje:
            "Solo el anfitrión puede terminar la Partida y volver al Lobby.",
        },
      };
    }

    this.#temporizadorFinAt = null;
    this.#estado = volverAlLobby(this.#estado);
    return { clase: "DIFUNDIR", eventos: [] };
  }

  #enviarChat(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (
      this.#estado.fase !== "EN_CURSO" &&
      this.#estado.fase !== "FINALIZADA"
    ) {
      return {
        clase: "ERROR",
        error: {
          codigo: "ACCION_NO_PERMITIDA",
          mensaje: "El chat solo está disponible durante la Partida.",
        },
      };
    }

    if (!esObjeto(payload)) {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Falta el texto del mensaje de chat."),
      };
    }

    const texto = sanearTextoChat(payload["texto"]);
    if (texto === null) {
      return {
        clase: "IGNORADO",
        error: errorGenerico("El mensaje de chat está vacío."),
      };
    }

    const autor = this.#estado.jugadores.find((j) => j.id === jugadorId);
    if (autor === undefined) {
      return {
        clase: "ERROR",
        error: errorGenerico("Solo los jugadores pueden escribir en el chat."),
      };
    }

    const mensaje: MensajeChat = {
      id: randomUUID(),
      autorId: autor.id,
      autorNombre: autor.nombre,
      texto,
      enviadoEnMs: Date.now(),
    };
    this.#estado = agregarMensajeChat(this.#estado, mensaje);
    return { clase: "DIFUNDIR", eventos: [] };
  }

  /** Indica si hay una terminación pendiente activa. */
  tieneTerminacionPorDesconexionPendiente(): boolean {
    return this.#estado.terminacionPorDesconexion != null;
  }

  // -------------------------------------------------------------------------
  // Acciones del Motor_Juego
  // -------------------------------------------------------------------------

  #tomarFicha(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (!esObjeto(payload) || !esFicha(payload["ficha"])) {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Ficha inválida en la solicitud."),
      };
    }
    return this.#aplicar({
      tipo: "TOMAR_FICHA",
      jugadorId,
      ficha: payload["ficha"],
    });
  }

  #intercambiarCentro(
    jugadorId: string,
    payload: unknown,
  ): ResultadoCoordinador {
    if (!esObjeto(payload) || !esFicha(payload["fichaCentro"])) {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Ficha del centro inválida en la solicitud."),
      };
    }
    return this.#aplicar({
      tipo: "INTERCAMBIAR_CENTRO",
      jugadorId,
      fichaCentro: payload["fichaCentro"],
    });
  }

  #intercambiarJugador(
    jugadorId: string,
    payload: unknown,
  ): ResultadoCoordinador {
    if (!esObjeto(payload) || typeof payload["jugadorB"] !== "string") {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Falta el Jugador con quien intercambiar."),
      };
    }
    // El emisor solo puede intercambiar con SU propia Ficha como jugadorA.
    return this.#aplicar({
      tipo: "INTERCAMBIAR_JUGADOR",
      jugadorA: jugadorId,
      jugadorB: payload["jugadorB"],
    });
  }

  /**
   * Aplica una acción del Motor_Juego al estado autoritativo. Si el dominio
   * rechaza la acción, devuelve el error SOLO al emisor sin mutar el estado
   * (criterios 4.7, 10.4). Si la acepta, reemplaza el estado y señala DIFUNDIR.
   */
  #aplicar(accion: Accion): ResultadoCoordinador {
    const resultado = aplicarAccion(this.#estado, accion);
    if (!resultado.ok) {
      // Estado compartido intacto; error solo al emisor.
      return { clase: "ERROR", error: resultado.error };
    }
    this.#estado = resultado.estado;
    return { clase: "DIFUNDIR", eventos: resultado.eventos };
  }

  // -------------------------------------------------------------------------
  // Solicitudes privadas
  // -------------------------------------------------------------------------

  #solicitarCartas(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (!esObjeto(payload) || typeof payload["objetivoId"] !== "string") {
      return {
        clase: "IGNORADO",
        error: errorGenerico("Falta el Jugador cuyas cartas se solicitan."),
      };
    }

    const resultado = solicitarCartasDe(
      this.#estado,
      jugadorId,
      payload["objetivoId"],
    );
    if (!resultado.ok) {
      // ACCION_NO_PERMITIDA sin revelar valores (criterios 4.7, 10.4).
      return { clase: "ERROR", error: resultado.error };
    }

    return {
      clase: "PRIVADO",
      mensaje: {
        tipo: MensajeServidor.CARTAS,
        payload: {
          jugadorId: payload["objetivoId"],
          bolsillo: resultado.bolsillo,
        },
      },
    };
  }
}

/**
 * Crea un Coordinador de Partida. Factory de conveniencia para la integración
 * (tarea 17) y las pruebas.
 */
export function crearCoordinador(
  opciones: OpcionesCoordinador = {},
): Coordinador {
  return new Coordinador(opciones);
}
