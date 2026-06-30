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
} from '../dominio/motorJuego';
import {
  abandonarJugador,
  registrarJugador,
  validarInicio,
} from '../dominio/lobby';
import {
  proyectarEstadoPara,
  solicitarCartasDe,
  type VistaPartida,
} from '../dominio/proyeccion';
import {
  type ColorFicha,
  type ErrorJuego,
  type EstadoPartida,
  type EventoJuego,
  type Ficha,
  type Semilla,
} from '../dominio/modelos';
import { type MensajeEntrante, type MensajeSaliente } from './tipos';

// ===========================================================================
// Protocolo de mensajes (tipo)
// ===========================================================================

/**
 * Tipos de mensaje ENTRANTE que el Coordinador entiende (cliente → servidor).
 * Cualquier otro `tipo` se considera desconocido y produce un resultado
 * `IGNORADO` con un error genérico solo al emisor.
 */
export const MensajeCliente = {
  /** Registrarse en el Lobby. payload: `{ nombre: string }`. */
  UNIRSE: 'UNIRSE',
  /** Abandonar el Lobby antes del inicio. payload: ninguno. */
  ABANDONAR: 'ABANDONAR',
  /** Iniciar la Partida (requiere 3..6 Jugadores). payload: ninguno. */
  INICIAR: 'INICIAR',
  /** Avanzar de Ronda o iniciar el Showdown. payload: ninguno. */
  AVANZAR: 'AVANZAR',
  /** Resolver el Showdown del Golpe. payload: ninguno. */
  RESOLVER_SHOWDOWN: 'RESOLVER_SHOWDOWN',
  /** Tomar una Ficha del centro. payload: `{ ficha: Ficha }`. */
  TOMAR_FICHA: 'TOMAR_FICHA',
  /** Intercambiar la Ficha propia por una del centro. payload: `{ fichaCentro: Ficha }`. */
  INTERCAMBIAR_CENTRO: 'INTERCAMBIAR_CENTRO',
  /** Intercambiar la Ficha propia con otro Jugador. payload: `{ jugadorB: string }`. */
  INTERCAMBIAR_JUGADOR: 'INTERCAMBIAR_JUGADOR',
  /** Solicitar las Cartas de Bolsillo de un Jugador. payload: `{ objetivoId: string }`. */
  SOLICITAR_CARTAS: 'SOLICITAR_CARTAS',
} as const;

/**
 * Tipos de mensaje SALIENTE privados que el Coordinador genera para el emisor.
 * El estado completo se difunde como vistas mediante el Difusor (tarea 14.2),
 * por lo que aquí solo aparecen respuestas dirigidas al emisor.
 */
export const MensajeServidor = {
  /** Error de juego o mensaje genérico dirigido solo al emisor. */
  ERROR: 'ERROR',
  /** Respuesta a una solicitud de Cartas de Bolsillo. */
  CARTAS: 'CARTAS',
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
  | { clase: 'DIFUNDIR'; eventos: EventoJuego[] }
  | { clase: 'ERROR'; error: ErrorJuego }
  | { clase: 'PRIVADO'; mensaje: MensajeSaliente }
  | { clase: 'IGNORADO'; error: ErrorJuego };

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
  return typeof valor === 'object' && valor !== null;
}

function esFicha(valor: unknown): valor is Ficha {
  if (!esObjeto(valor)) {
    return false;
  }
  const color = valor['color'];
  const estrellas = valor['estrellas'];
  const coloresValidos: readonly ColorFicha[] = [
    'BLANCO',
    'AMARILLO',
    'NARANJA',
    'ROJO',
  ];
  return (
    typeof color === 'string' &&
    (coloresValidos as readonly string[]).includes(color) &&
    typeof estrellas === 'number' &&
    Number.isInteger(estrellas)
  );
}

/** Error genérico para mensajes malformados o de tipo desconocido. */
function errorGenerico(mensaje: string): ErrorJuego {
  return { codigo: 'ACCION_NO_PERMITIDA', mensaje };
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

  constructor(opciones: OpcionesCoordinador = {}) {
    this.#generarSemilla = opciones.generarSemilla ?? (() => Date.now());
    this.#estado = Coordinador.#estadoLobbyInicial();
  }

  /** Construye el estado inicial en fase LOBBY, sin Jugadores ni Golpe. */
  static #estadoLobbyInicial(): EstadoPartida {
    return {
      fase: 'LOBBY',
      jugadores: [],
      golpeActual: null,
      golpesJugados: 0,
      bovedasDoradas: 0,
      alarmasRojas: 0,
      resultado: null,
      semilla: 0,
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
    return proyectarEstadoPara(this.#estado, jugadorId);
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
  ): ResultadoCoordinador {
    if (!esObjeto(mensaje) || typeof mensaje.tipo !== 'string') {
      return {
        clase: 'IGNORADO',
        error: errorGenerico('Mensaje no reconocido por el Servidor_Local.'),
      };
    }

    switch (mensaje.tipo) {
      case MensajeCliente.UNIRSE:
        return this.#unirse(jugadorId, mensaje.payload);
      case MensajeCliente.ABANDONAR:
        return this.#abandonar(jugadorId);
      case MensajeCliente.INICIAR:
        return this.#iniciar();
      case MensajeCliente.AVANZAR:
        return this.#aplicar({ tipo: 'AVANZAR' });
      case MensajeCliente.RESOLVER_SHOWDOWN:
        return this.#aplicar({ tipo: 'RESOLVER_SHOWDOWN' });
      case MensajeCliente.TOMAR_FICHA:
        return this.#tomarFicha(jugadorId, mensaje.payload);
      case MensajeCliente.INTERCAMBIAR_CENTRO:
        return this.#intercambiarCentro(jugadorId, mensaje.payload);
      case MensajeCliente.INTERCAMBIAR_JUGADOR:
        return this.#intercambiarJugador(jugadorId, mensaje.payload);
      case MensajeCliente.SOLICITAR_CARTAS:
        return this.#solicitarCartas(jugadorId, mensaje.payload);
      default:
        return {
          clase: 'IGNORADO',
          error: errorGenerico(
            `Tipo de mensaje desconocido: "${mensaje.tipo}".`,
          ),
        };
    }
  }

  // -------------------------------------------------------------------------
  // Operaciones de Lobby
  // -------------------------------------------------------------------------

  #unirse(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (this.#estado.fase !== 'LOBBY') {
      return {
        clase: 'ERROR',
        error: {
          codigo: 'PARTIDA_EN_CURSO',
          mensaje: 'No es posible unirse: la Partida ya está en marcha.',
        },
      };
    }
    if (!esObjeto(payload) || typeof payload['nombre'] !== 'string') {
      return {
        clase: 'IGNORADO',
        error: errorGenerico('Falta un nombre válido para unirse.'),
      };
    }

    const resultado = registrarJugador(
      this.#estado.jugadores,
      payload['nombre'],
      jugadorId,
    );
    if (!resultado.ok) {
      return { clase: 'ERROR', error: resultado.error };
    }

    this.#estado = { ...this.#estado, jugadores: resultado.jugadores };
    return { clase: 'DIFUNDIR', eventos: [] };
  }

  #abandonar(jugadorId: string): ResultadoCoordinador {
    if (this.#estado.fase !== 'LOBBY') {
      return {
        clase: 'ERROR',
        error: {
          codigo: 'ACCION_NO_PERMITIDA',
          mensaje: 'No es posible abandonar el Lobby con la Partida en curso.',
        },
      };
    }

    const jugadores = abandonarJugador(this.#estado.jugadores, jugadorId);
    if (jugadores.length === this.#estado.jugadores.length) {
      // El Jugador no estaba registrado: nada cambia, nada que difundir.
      return {
        clase: 'ERROR',
        error: errorGenerico('No estabas registrado en el Lobby.'),
      };
    }

    this.#estado = { ...this.#estado, jugadores };
    return { clase: 'DIFUNDIR', eventos: [] };
  }

  #iniciar(): ResultadoCoordinador {
    if (this.#estado.fase === 'EN_CURSO') {
      return {
        clase: 'ERROR',
        error: {
          codigo: 'PARTIDA_EN_CURSO',
          mensaje: 'La Partida ya está en curso.',
        },
      };
    }
    if (this.#estado.fase === 'FINALIZADA') {
      return {
        clase: 'ERROR',
        error: {
          codigo: 'PARTIDA_FINALIZADA',
          mensaje: 'La Partida ya ha finalizado.',
        },
      };
    }

    const errorInicio = validarInicio(this.#estado.jugadores);
    if (errorInicio !== null) {
      return { clase: 'ERROR', error: errorInicio };
    }

    this.#estado = iniciarPartida(this.#estado.jugadores, this.#generarSemilla());
    return {
      clase: 'DIFUNDIR',
      eventos: [
        { tipo: 'PARTIDA_INICIADA' },
        { tipo: 'GOLPE_INICIADO', numero: 1 },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Acciones del Motor_Juego
  // -------------------------------------------------------------------------

  #tomarFicha(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (!esObjeto(payload) || !esFicha(payload['ficha'])) {
      return {
        clase: 'IGNORADO',
        error: errorGenerico('Ficha inválida en la solicitud.'),
      };
    }
    return this.#aplicar({
      tipo: 'TOMAR_FICHA',
      jugadorId,
      ficha: payload['ficha'],
    });
  }

  #intercambiarCentro(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (!esObjeto(payload) || !esFicha(payload['fichaCentro'])) {
      return {
        clase: 'IGNORADO',
        error: errorGenerico('Ficha del centro inválida en la solicitud.'),
      };
    }
    return this.#aplicar({
      tipo: 'INTERCAMBIAR_CENTRO',
      jugadorId,
      fichaCentro: payload['fichaCentro'],
    });
  }

  #intercambiarJugador(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (!esObjeto(payload) || typeof payload['jugadorB'] !== 'string') {
      return {
        clase: 'IGNORADO',
        error: errorGenerico('Falta el Jugador con quien intercambiar.'),
      };
    }
    // El emisor solo puede intercambiar con SU propia Ficha como jugadorA.
    return this.#aplicar({
      tipo: 'INTERCAMBIAR_JUGADOR',
      jugadorA: jugadorId,
      jugadorB: payload['jugadorB'],
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
      return { clase: 'ERROR', error: resultado.error };
    }
    this.#estado = resultado.estado;
    return { clase: 'DIFUNDIR', eventos: resultado.eventos };
  }

  // -------------------------------------------------------------------------
  // Solicitudes privadas
  // -------------------------------------------------------------------------

  #solicitarCartas(jugadorId: string, payload: unknown): ResultadoCoordinador {
    if (!esObjeto(payload) || typeof payload['objetivoId'] !== 'string') {
      return {
        clase: 'IGNORADO',
        error: errorGenerico('Falta el Jugador cuyas cartas se solicitan.'),
      };
    }

    const resultado = solicitarCartasDe(
      this.#estado,
      jugadorId,
      payload['objetivoId'],
    );
    if (!resultado.ok) {
      // ACCION_NO_PERMITIDA sin revelar valores (criterios 4.7, 10.4).
      return { clase: 'ERROR', error: resultado.error };
    }

    return {
      clase: 'PRIVADO',
      mensaje: {
        tipo: MensajeServidor.CARTAS,
        payload: { jugadorId: payload['objetivoId'], bolsillo: resultado.bolsillo },
      },
    };
  }
}

/**
 * Crea un Coordinador de Partida. Factory de conveniencia para la integración
 * (tarea 17) y las pruebas.
 */
export function crearCoordinador(opciones: OpcionesCoordinador = {}): Coordinador {
  return new Coordinador(opciones);
}
