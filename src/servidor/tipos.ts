// Tipos de la capa de transporte del Servidor_Local.
//
// Define la interfaz pública del servidor (alineada con el documento de
// diseño), la dirección de acceso LAN publicada y el formato de los mensajes
// que viajan por el canal WebSocket.
//
// NOTA DE SEGURIDAD: el Servidor_Local está pensado para una LAN de confianza
// (oficina). No incluye autenticación fuerte: cualquier equipo en la misma red
// puede conectarse. Esto se documenta como una limitación aceptada del alcance
// LAN inicial (ver design.md, "Nota de seguridad").

/** Dirección de acceso publicada al Anfitrión (criterios 1.1, 1.2). */
export interface DireccionAcceso {
  /** URL completa, p. ej. `http://192.168.1.42:3000`. */
  url: string;
  /** IPv4 de la red local detectada. */
  ipLan: string;
  /** Puerto en el que el servidor quedó escuchando. */
  puerto: number;
}

/**
 * Interfaz pública del Servidor_Local (capa de transporte).
 *
 * La gestión de sesiones/reconexión (tarea 13.2) y el coordinador de juego
 * (tarea 14) se conectan mediante los manejadores de {@link OpcionesServidor};
 * esta interfaz solo cubre el ciclo de vida de arranque y parada.
 */
export interface ServidorLocal {
  /**
   * Arranca el servidor HTTP + WebSocket y devuelve la dirección LAN publicada.
   * Rechaza con {@link PuertoOcupadoError} si el puerto ya está en uso, de modo
   * que el Anfitrión pueda reintentar con otro puerto sin que el proceso caiga
   * silenciosamente (criterio 1.1).
   */
  iniciar(puerto: number): Promise<DireccionAcceso>;
  /** Cierra de forma limpia el servidor HTTP y las conexiones WebSocket. */
  detener(): Promise<void>;
}

// ===========================================================================
// Formato de mensajes WebSocket (tipo + payload)
// ===========================================================================

/**
 * Mensaje entrante validado: todo mensaje del canal WebSocket es un objeto JSON
 * con un campo `tipo` (cadena no vacía) y un `payload` opcional. Los mensajes
 * que no respeten este formato se consideran malformados y se ignoran,
 * respondiendo un error genérico solo al emisor (ver design.md, "Mensajes
 * malformados").
 */
export interface MensajeEntrante {
  /** Discriminador del tipo de mensaje. */
  tipo: string;
  /** Datos asociados al mensaje, dependientes del tipo. */
  payload?: unknown;
}

/** Mensaje saliente que el servidor envía a un cliente. */
export interface MensajeSaliente {
  /** Discriminador del tipo de mensaje. */
  tipo: string;
  /** Datos asociados al mensaje, dependientes del tipo. */
  payload?: unknown;
}

/**
 * Representa una conexión de cliente desde la perspectiva de los manejadores.
 * Abstrae el socket subyacente para que las capas superiores (sesiones,
 * coordinador) no dependan directamente de `ws` y sean testeables.
 */
export interface ConexionCliente {
  /** Identificador único y opaco de la conexión (no es el sessionId del jugador). */
  readonly id: string;
  /** Envía un mensaje a este cliente. No lanza si la conexión ya está cerrada. */
  enviar(mensaje: MensajeSaliente): void;
  /** Cierra la conexión con este cliente. */
  cerrar(): void;
}

/**
 * Puntos de extensión para conectar el gestor de sesiones (tarea 13.2) y el
 * coordinador de partida (tarea 14). Todos son opcionales: sin ellos, el
 * servidor solo sirve la SPA y responde a mensajes malformados.
 */
export interface ManejadoresServidor {
  /** Se invoca cuando un cliente abre una conexión WebSocket. */
  alConectar?(conexion: ConexionCliente): void;
  /** Se invoca con cada mensaje entrante bien formado. */
  alRecibirMensaje?(conexion: ConexionCliente, mensaje: MensajeEntrante): void;
  /** Se invoca cuando un cliente cierra o pierde la conexión. */
  alDesconectar?(conexion: ConexionCliente): void;
}

/** Opciones de configuración del Servidor_Local. */
export interface OpcionesServidor {
  /**
   * Directorio con los archivos estáticos de la SPA a servir. Por defecto,
   * `dist/cliente` (la salida del build de Vite). Se documenta que debe
   * ejecutarse `npm run build` antes de servir en producción.
   */
  directorioEstaticos?: string;
  /** Manejadores de los eventos del canal WebSocket (extensión 13.2 / 14). */
  manejadores?: ManejadoresServidor;
}

/**
 * Error lanzado cuando el puerto solicitado ya está en uso (EADDRINUSE). El
 * Anfitrión puede capturarlo para informar y reintentar con otro puerto.
 */
export class PuertoOcupadoError extends Error {
  constructor(public readonly puerto: number) {
    super(
      `El puerto ${puerto} ya está en uso. Cierra el proceso que lo ocupa o ` +
        `inicia el Servidor_Local en otro puerto.`,
    );
    this.name = 'PuertoOcupadoError';
  }
}
