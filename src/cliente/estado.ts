// Store/estado del Cliente_Jugador.
//
// El cliente es esencialmente una VISTA reactiva del estado autoritativo del
// Servidor_Local: guarda la última `VistaPartida` recibida, el estado de la
// conexión y el último mensaje de error, y notifica a los suscriptores para que
// la interfaz se vuelva a renderizar.
//
// No contiene lógica de reglas: solo conserva lo recibido y el borrador del
// nombre que el Jugador teclea en el Lobby.

import type { VistaPartida } from './protocolo';

/** Estado del canal con el Servidor_Local. */
export type EstadoConexion = 'CONECTANDO' | 'CONECTADO' | 'DESCONECTADO';

/** Estado completo del cliente que la interfaz renderiza. */
export interface EstadoCliente {
  /** Estado actual de la conexión WebSocket. */
  conexion: EstadoConexion;
  /** Última vista de la Partida recibida del servidor, o null al arrancar. */
  vista: VistaPartida | null;
  /** Último mensaje de error recibido (en español), o null si no hay. */
  error: string | null;
  /** Borrador del nombre que el Jugador escribe en el Lobby (1..20). */
  nombreBorrador: string;
}

/** Función suscriptora que se invoca tras cada cambio de estado. */
export type Suscriptor = (estado: EstadoCliente) => void;

/**
 * Store mínimo y observable del cliente. Mantiene el estado inmutable: cada
 * actualización produce un objeto nuevo y notifica a los suscriptores.
 */
export class StoreCliente {
  #estado: EstadoCliente = {
    conexion: 'CONECTANDO',
    vista: null,
    error: null,
    nombreBorrador: '',
  };
  readonly #suscriptores = new Set<Suscriptor>();

  /** Devuelve el estado actual (inmutable; no mutar desde fuera). */
  obtener(): EstadoCliente {
    return this.#estado;
  }

  /** Suscribe una función a los cambios de estado. Devuelve el des-suscriptor. */
  suscribir(suscriptor: Suscriptor): () => void {
    this.#suscriptores.add(suscriptor);
    return () => {
      this.#suscriptores.delete(suscriptor);
    };
  }

  /** Aplica un cambio parcial al estado y notifica a los suscriptores. */
  actualizar(parcial: Partial<EstadoCliente>): void {
    this.#estado = { ...this.#estado, ...parcial };
    this.#notificar();
  }

  /**
   * Actualiza el borrador del nombre SIN notificar. Se usa mientras el Jugador
   * teclea para no re-renderizar (y no perder el foco) en cada pulsación.
   */
  fijarNombreBorrador(nombre: string): void {
    this.#estado = { ...this.#estado, nombreBorrador: nombre };
  }

  /** Registra la nueva vista recibida del servidor y limpia el error previo. */
  recibirVista(vista: VistaPartida): void {
    this.actualizar({ vista, error: null });
  }

  /** Registra un mensaje de error recibido del servidor. */
  recibirError(mensaje: string): void {
    this.actualizar({ error: mensaje });
  }

  /** Cambia el estado de la conexión. */
  fijarConexion(conexion: EstadoConexion): void {
    this.actualizar({ conexion });
  }

  #notificar(): void {
    for (const suscriptor of this.#suscriptores) {
      suscriptor(this.#estado);
    }
  }
}

// ===========================================================================
// Selectores derivados
// ===========================================================================

/** ¿Está el Jugador local ya registrado en la lista de la Partida? */
export function jugadorRegistrado(estado: EstadoCliente): boolean {
  const vista = estado.vista;
  if (vista === null) {
    return false;
  }
  return vista.jugadores.some((j) => j.id === vista.perspectivaJugadorId);
}
