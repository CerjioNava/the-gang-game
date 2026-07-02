// Difusor de Estado del Servidor_Local: difunde a cada cliente CONECTADO su
// vista personalizada del estado autoritativo (tarea 14.2).
//
// Ubicación en la arquitectura (ver design.md, "Capas del servidor" y
// "Difusor de Estado / vistas por jugador"):
//
//   Coordinador --(resultado DIFUNDIR)--> Difusor --> Capa de Transporte (ws)
//
// El Coordinador es la única fuente de verdad del `EstadoPartida` y, cada vez
// que una acción válida lo modifica, devuelve un resultado `DIFUNDIR`. La capa
// de integración (tarea 17) reacciona a ese resultado invocando
// {@link Difusor.difundir}, que envía a cada Jugador conectado su vista filtrada
// por privacidad (criterios 4.2, 4.6, 10.3 mediante `proyectarEstadoPara`).
//
// Esto cubre los criterios temporales de actualización ante cambios de:
//   - lista de Jugadores en el Lobby (criterio 2.6),
//   - asignación de Fichas (criterio 6.6),
//   - resultado final de la Partida (criterio 9.3).
//
// CORRESPONDENCIA DE IDENTIDAD (importante):
//   El Coordinador identifica a cada Jugador por un `jugadorId`. En
//   `procesarMensaje(jugadorId, mensaje)`, al UNIRSE se registra al Jugador con
//   ese `jugadorId`; las vistas se proyectan con el mismo id mediante
//   `Coordinador.obtenerVistaPara(jugadorId)`.
//
//   La capa de transporte usa el `sessionId` de la {@link SesionJugador} como
//   `jugadorId` al llamar al Coordinador. Por tanto, para difundir la vista
//   correcta a cada cliente, el Difusor usa `sesion.sessionId` como `jugadorId`.
//   Mantener esta equivalencia (sessionId === jugadorId) es lo que garantiza que
//   cada Jugador reciba SUS Cartas de Bolsillo y no las ajenas.
//
// Diseño testeable: el Difusor recibe sus dependencias por constructor (mapa de
// conexiones activas, gestor de sesiones y coordinador). NO depende de `ws`:
// envía mensajes a través de la abstracción {@link ConexionCliente}, de modo que
// las pruebas (tarea 14.3) pueden inyectar conexiones simuladas.
//
// _Requirements: 2.6, 6.6, 9.3_

import type { VistaPartida } from '../dominio/proyeccion';
import { aplicarEstadoConexion } from '../dominio/proyeccion';
import type { Coordinador } from './coordinador';
import type { GestorSesiones } from './sesiones';
import type { ConexionCliente, MensajeSaliente } from './tipos';

// ===========================================================================
// Protocolo de difusión
// ===========================================================================

/**
 * Tipo del mensaje SALIENTE de difusión de estado. Cada cliente conectado recibe
 * un `MensajeSaliente { tipo: 'ESTADO', payload: VistaPartida }` con su vista
 * personalizada del estado autoritativo.
 */
export const TIPO_MENSAJE_ESTADO = 'ESTADO' as const;

/**
 * Origen de las conexiones activas indexadas por su `conexionId` (el `id` de
 * {@link ConexionCliente}). La capa de transporte (tarea 17) mantiene este mapa
 * vivo a medida que los clientes se conectan y desconectan; el Difusor solo lo
 * consulta. Se acepta un `ReadonlyMap` para señalar que el Difusor no lo muta.
 */
export type ConexionesActivas = ReadonlyMap<string, ConexionCliente>;

// ===========================================================================
// Difusor
// ===========================================================================

/**
 * Difunde el estado autoritativo a los clientes conectados como vistas
 * personalizadas y filtradas por privacidad.
 *
 * Dependencias (inyectadas por constructor para mantener el módulo testeable):
 * - `conexiones`: mapa vivo `conexionId → ConexionCliente` de conexiones activas.
 * - `gestor`: {@link GestorSesiones}, fuente de las sesiones y su estado de
 *   conexión.
 * - `coordinador`: {@link Coordinador}, dueño del estado autoritativo y de
 *   `obtenerVistaPara(jugadorId)`.
 */
export class Difusor {
  readonly #conexiones: ConexionesActivas;
  readonly #gestor: GestorSesiones;
  readonly #coordinador: Coordinador;

  constructor(
    conexiones: ConexionesActivas,
    gestor: GestorSesiones,
    coordinador: Coordinador,
  ) {
    this.#conexiones = conexiones;
    this.#gestor = gestor;
    this.#coordinador = coordinador;
  }

  /**
   * Difunde a cada Jugador CONECTADO su vista personalizada del estado actual.
   *
   * Para cada sesión con una conexión activa (`conectado === true` y
   * `conexionId !== null`) que tenga una {@link ConexionCliente} viva en el mapa,
   * proyecta la vista mediante `coordinador.obtenerVistaPara(sessionId)` —usando
   * el `sessionId` como `jugadorId`, ver "CORRESPONDENCIA DE IDENTIDAD"— y la
   * envía como `MensajeSaliente { tipo: 'ESTADO', payload: vista }`.
   *
   * El envío es seguro: nunca lanza si una conexión está cerrada o si
   * `enviar` falla (ver {@link Difusor.#enviarSeguro}).
   *
   * @returns El número de clientes a los que se difundió el estado.
   */
  difundirEstado(): number {
    const conexionPorJugador = new Map(
      this.#gestor.sesiones().map((sesion) => [sesion.sessionId, sesion.conectado]),
    );

    let enviados = 0;
    for (const sesion of this.#gestor.sesiones()) {
      if (!sesion.conectado || sesion.conexionId === null) {
        continue;
      }
      const conexion = this.#conexiones.get(sesion.conexionId);
      if (conexion === undefined) {
        continue;
      }
      // sessionId === jugadorId (ver nota de correspondencia de identidad).
      const vistaBase: VistaPartida = this.#coordinador.obtenerVistaPara(
        sesion.sessionId,
      );
      const vista = aplicarEstadoConexion(vistaBase, conexionPorJugador);
      const mensaje: MensajeSaliente = {
        tipo: TIPO_MENSAJE_ESTADO,
        payload: vista,
      };
      if (this.#enviarSeguro(conexion, mensaje)) {
        enviados += 1;
      }
    }
    enviados += this.#difundirLobbyInvitados(conexionPorJugador);
    return enviados;
  }

  /**
   * Punto de entrada que la integración invoca tras cada resultado `DIFUNDIR`
   * del Coordinador (cambios en la lista de Jugadores, las Fichas o el resultado
   * final). Es un alias semántico de {@link Difusor.difundirEstado} para que el
   * código de orquestación exprese su intención con claridad.
   *
   * @returns El número de clientes a los que se difundió el estado.
   */
  difundir(): number {
    return this.difundirEstado();
  }

  /**
   * Envía la vista pública del Lobby a una conexión sin sesión (invitado).
   * @returns `true` si se envió la vista; `false` si no aplica o falló el envío.
   */
  enviarVistaInvitado(conexion: ConexionCliente): boolean {
    const fase = this.#coordinador.obtenerEstado().fase;
    if (fase !== 'LOBBY' && fase !== 'EN_CURSO') {
      return false;
    }
    const conexionPorJugador = new Map(
      this.#gestor.sesiones().map((sesion) => [sesion.sessionId, sesion.conectado]),
    );
    const vistaBase = this.#coordinador.obtenerVistaInvitado();
    const vista = aplicarEstadoConexion(vistaBase, conexionPorJugador);
    return this.#enviarSeguro(conexion, {
      tipo: TIPO_MENSAJE_ESTADO,
      payload: vista,
    });
  }

  #idsConexionConSesion(): Set<string> {
    const ids = new Set<string>();
    for (const sesion of this.#gestor.sesiones()) {
      if (sesion.conectado && sesion.conexionId !== null) {
        ids.add(sesion.conexionId);
      }
    }
    return ids;
  }

  #difundirLobbyInvitados(conexionPorJugador: ReadonlyMap<string, boolean>): number {
    const fase = this.#coordinador.obtenerEstado().fase;
    if (fase !== 'LOBBY' && fase !== 'EN_CURSO') {
      return 0;
    }
    const vistaBase = this.#coordinador.obtenerVistaInvitado();
    const vista = aplicarEstadoConexion(vistaBase, conexionPorJugador);
    const mensaje: MensajeSaliente = {
      tipo: TIPO_MENSAJE_ESTADO,
      payload: vista,
    };
    const conSesion = this.#idsConexionConSesion();
    let enviados = 0;
    for (const [conexionId, conexion] of this.#conexiones) {
      if (conSesion.has(conexionId)) {
        continue;
      }
      if (this.#enviarSeguro(conexion, mensaje)) {
        enviados += 1;
      }
    }
    return enviados;
  }

  /**
   * Envía un mensaje a una conexión sin propagar errores. La abstracción
   * {@link ConexionCliente#enviar} ya promete no lanzar con conexiones cerradas,
   * pero se protege de cualquier excepción inesperada para que un cliente con
   * problemas no impida la difusión al resto.
   *
   * @returns `true` si el envío se realizó sin excepción; `false` si falló.
   */
  #enviarSeguro(conexion: ConexionCliente, mensaje: MensajeSaliente): boolean {
    try {
      conexion.enviar(mensaje);
      return true;
    } catch {
      // Conexión cerrada o en mal estado: se ignora para no afectar al resto.
      return false;
    }
  }
}

/**
 * Crea un Difusor de Estado. Factory de conveniencia para la integración
 * (tarea 17) y las pruebas (tarea 14.3).
 */
export function crearDifusor(
  conexiones: ConexionesActivas,
  gestor: GestorSesiones,
  coordinador: Coordinador,
): Difusor {
  return new Difusor(conexiones, gestor, coordinador);
}
