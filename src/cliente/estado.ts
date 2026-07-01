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

/** Alias elegido antes de unirse (sorteo o manual). */
export interface AliasElegido {
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  esManual: boolean;
}

/** Estado completo del cliente que la interfaz renderiza. */
export interface EstadoCliente {
  /** Estado actual de la conexión WebSocket. */
  conexion: EstadoConexion;
  /** Última vista de la Partida recibida del servidor, o null al arrancar. */
  vista: VistaPartida | null;
  /** Último mensaje de error recibido (en español), o null si no hay. */
  error: string | null;
  /** Borrador del nombre en modo manual (1..20). */
  nombreBorrador: string;
  /** Borrador de la descripción en modo manual (opcional). */
  descripcionBorrador: string;
  /** Alias confirmado para unirse (sorteo o manual). */
  aliasElegido: AliasElegido | null;
  /** Modo de entrada usado al enviar UNIRSE (interno). */
  modoUnirse: 'JUGADOR' | 'ESPECTADOR';
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
    descripcionBorrador: '',
    aliasElegido: null,
    modoUnirse: 'JUGADOR',
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

  /** Actualiza el borrador de descripción sin notificar (modo manual). */
  fijarDescripcionBorrador(descripcion: string): void {
    this.#estado = { ...this.#estado, descripcionBorrador: descripcion };
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
  if (vista === null || vista.esEspectador) {
    return false;
  }
  return vista.jugadores.some((j) => j.id === vista.perspectivaJugadorId);
}

/** ¿Está el cliente registrado como espectador? */
export function espectadorRegistrado(estado: EstadoCliente): boolean {
  return estado.vista?.esEspectador ?? false;
}

/** ¿Está registrado como jugador o espectador? */
export function participanteRegistrado(estado: EstadoCliente): boolean {
  return jugadorRegistrado(estado) || espectadorRegistrado(estado);
}

const NOMBRE_MIN = 1;
const NOMBRE_MAX = 20;
export const DESCRIPCION_MAX = 120;

function descripcionNormalizada(texto: string | null | undefined): string | undefined {
  const recortada = (texto ?? '').trim();
  return recortada.length > 0 ? recortada : undefined;
}

/** Indica si hay un alias válido listo para enviar al servidor. */
export function tieneNombreValido(estado: EstadoCliente): boolean {
  if (estado.aliasElegido !== null && !estado.aliasElegido.esManual) {
    const nombre = estado.aliasElegido.nombre.trim();
    return nombre.length >= NOMBRE_MIN && nombre.length <= NOMBRE_MAX;
  }
  const nombre = estado.nombreBorrador.trim();
  return nombre.length >= NOMBRE_MIN && nombre.length <= NOMBRE_MAX;
}

/** Descripción opcional para enviar al unirse. */
export function descripcionParaUnirse(estado: EstadoCliente): string | undefined {
  if (estado.aliasElegido !== null && !estado.aliasElegido.esManual) {
    return descripcionNormalizada(estado.aliasElegido.descripcion);
  }
  return descripcionNormalizada(estado.descripcionBorrador);
}

/** Indica si la descripción manual supera el límite permitido. */
export function descripcionManualValida(estado: EstadoCliente): boolean {
  return estado.descripcionBorrador.trim().length <= DESCRIPCION_MAX;
}

/** Nombre efectivo para unirse (alias sorteado o borrador manual). */
export function nombreParaUnirse(estado: EstadoCliente): string {
  if (estado.aliasElegido !== null && !estado.aliasElegido.esManual) {
    return estado.aliasElegido.nombre.trim();
  }
  return estado.nombreBorrador.trim();
}
