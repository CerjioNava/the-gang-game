// Conexión WebSocket del Cliente_Jugador con el Servidor_Local.
//
// Construye la URL del canal a partir de `window.location` (mismo host/puerto
// desde el que se sirvió la SPA), gestiona la apertura, la recepción de mensajes
// JSON ({ tipo, payload }) y una reconexión básica con reintentos espaciados.
//
// La capa de conexión NO interpreta el contenido del juego: entrega los mensajes
// ya parseados a un manejador y notifica los cambios de estado de la conexión.

import type { MensajeCliente, MensajeServidor } from './protocolo';

/** Callbacks que la conexión invoca hacia la capa de presentación. */
export interface ManejadoresConexion {
  /** Se invoca al abrir (o reabrir) la conexión con el Servidor_Local. */
  alAbrir?(): void;
  /** Se invoca con cada mensaje entrante bien formado. */
  alRecibir?(mensaje: MensajeServidor): void;
  /** Se invoca al cerrarse la conexión (antes de intentar reconectar). */
  alCerrar?(): void;
}

/** Espera (ms) entre reintentos de reconexión. */
const RETARDO_RECONEXION_MS = 1500;

/**
 * Construye la URL del WebSocket a partir de la ubicación actual del navegador.
 * Usa `wss:` cuando la página se sirvió por HTTPS y `ws:` en otro caso, y
 * conserva host y puerto (p. ej. `ws://192.168.1.42:3000`).
 */
export function construirUrlWebSocket(location: Location): string {
  const protocolo = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocolo}//${location.host}`;
}

/**
 * Conexión gestionada con el Servidor_Local. Encapsula el `WebSocket` nativo,
 * reintenta automáticamente al perder la conexión y expone `enviar` para
 * mandar acciones del Jugador.
 */
export class ConexionServidor {
  #socket: WebSocket | null = null;
  #cerradaPorUsuario = false;
  #temporizadorReconexion: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly url: string,
    private readonly manejadores: ManejadoresConexion = {},
  ) {}

  /** Abre la conexión (idempotente mientras haya un socket activo). */
  conectar(): void {
    this.#cerradaPorUsuario = false;
    this.#abrir();
  }

  #abrir(): void {
    const socket = new WebSocket(this.url);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      this.manejadores.alAbrir?.();
    });

    socket.addEventListener('message', (evento: MessageEvent) => {
      const mensaje = this.#parsear(evento.data);
      if (mensaje !== null) {
        this.manejadores.alRecibir?.(mensaje);
      }
    });

    const alFinalizar = (): void => {
      if (this.#socket !== socket) {
        return; // socket ya reemplazado; ignorar evento tardío
      }
      this.#socket = null;
      this.manejadores.alCerrar?.();
      this.#programarReconexion();
    };

    socket.addEventListener('close', alFinalizar);
    socket.addEventListener('error', () => {
      // Forzamos el cierre para unificar el camino de reconexión.
      socket.close();
    });
  }

  #programarReconexion(): void {
    if (this.#cerradaPorUsuario || this.#temporizadorReconexion !== null) {
      return;
    }
    this.#temporizadorReconexion = setTimeout(() => {
      this.#temporizadorReconexion = null;
      if (!this.#cerradaPorUsuario) {
        this.#abrir();
      }
    }, RETARDO_RECONEXION_MS);
  }

  /** Envía una acción al Servidor_Local si la conexión está abierta. */
  enviar(mensaje: MensajeCliente): boolean {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(mensaje));
    return true;
  }

  /** Cierra la conexión de forma definitiva (sin reconexión). */
  cerrar(): void {
    this.#cerradaPorUsuario = true;
    if (this.#temporizadorReconexion !== null) {
      clearTimeout(this.#temporizadorReconexion);
      this.#temporizadorReconexion = null;
    }
    this.#socket?.close();
    this.#socket = null;
  }

  #parsear(datos: unknown): MensajeServidor | null {
    if (typeof datos !== 'string') {
      return null;
    }
    try {
      const objeto: unknown = JSON.parse(datos);
      if (
        typeof objeto === 'object' &&
        objeto !== null &&
        typeof (objeto as { tipo?: unknown }).tipo === 'string'
      ) {
        return objeto as MensajeServidor;
      }
      return null;
    } catch {
      return null;
    }
  }
}
