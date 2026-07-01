// Protocolo de mensajes del Cliente_Jugador (capa de presentación).
//
// El Cliente_Jugador no contiene lógica de reglas: solo envía INTENCIONES
// (acciones) al Servidor_Local y renderiza el ESTADO que recibe. Este módulo
// define el formato de los mensajes que viajan por el canal WebSocket, alineado
// con el Coordinador de Partida (`src/servidor/coordinador.ts`) y el Difusor de
// Estado (`src/servidor/difusor.ts`).
//
// Todos los textos visibles para el Jugador están en español y usan la temática
// de "banda de ladrones" (Golpe, Bóveda, Alarma, Ficha, Showdown).
//
// Las importaciones de tipos del dominio son SOLO de tipo (`import type`): se
// borran al compilar, de modo que el bundle del cliente no arrastra lógica de
// servidor.

import type { Ficha } from '../dominio/modelos';
import type { VistaPartida } from '../dominio/proyeccion';

// Re-exportamos los tipos de vista que el cliente consume, para que el resto de
// módulos del cliente importen desde un único punto.
export type { VistaPartida, JugadorVisible, EspectadorVisible } from '../dominio/proyeccion';
export type { Carta, Ficha, ColorFicha, Palo } from '../dominio/modelos';

// ===========================================================================
// Mensajes ENTRANTES (cliente → servidor)
// ===========================================================================

/** Tipos de mensaje que el cliente envía al Servidor_Local. */
export const TipoMensajeCliente = {
  UNIRSE: 'UNIRSE',
  ABANDONAR: 'ABANDONAR',
  EXPULSAR: 'EXPULSAR',
  INICIAR: 'INICIAR',
  CONFIGURAR_AJUSTES: 'CONFIGURAR_AJUSTES',
  AVANZAR: 'AVANZAR',
  RESOLVER_SHOWDOWN: 'RESOLVER_SHOWDOWN',
  TOMAR_FICHA: 'TOMAR_FICHA',
  INTERCAMBIAR_CENTRO: 'INTERCAMBIAR_CENTRO',
  INTERCAMBIAR_JUGADOR: 'INTERCAMBIAR_JUGADOR',
  SOLICITAR_CARTAS: 'SOLICITAR_CARTAS',
} as const;

/** Mensaje que el cliente envía al Servidor_Local (formato { tipo, payload }). */
export interface MensajeCliente {
  tipo: string;
  payload?: unknown;
}

/**
 * Constructores de mensajes salientes. Centralizar la construcción evita errores
 * de tipeo en los `tipo` y mantiene los payloads consistentes con el Coordinador.
 */
export const mensajes = {
  unirse(
    nombre: string,
    rol: 'JUGADOR' | 'ESPECTADOR' = 'JUGADOR',
    descripcion?: string,
  ): MensajeCliente {
    const payload: { nombre: string; rol: typeof rol; descripcion?: string } = {
      nombre,
      rol,
    };
    if (descripcion !== undefined && descripcion.length > 0) {
      payload.descripcion = descripcion;
    }
    return { tipo: TipoMensajeCliente.UNIRSE, payload };
  },
  abandonar(): MensajeCliente {
    return { tipo: TipoMensajeCliente.ABANDONAR };
  },
  expulsarMiembro(jugadorId: string): MensajeCliente {
    return { tipo: TipoMensajeCliente.EXPULSAR, payload: { jugadorId } };
  },
  iniciar(): MensajeCliente {
    return { tipo: TipoMensajeCliente.INICIAR };
  },
  configurarAjustes(ajustes: { sinKickers: boolean }): MensajeCliente {
    return { tipo: TipoMensajeCliente.CONFIGURAR_AJUSTES, payload: ajustes };
  },
  avanzar(): MensajeCliente {
    return { tipo: TipoMensajeCliente.AVANZAR };
  },
  resolverShowdown(): MensajeCliente {
    return { tipo: TipoMensajeCliente.RESOLVER_SHOWDOWN };
  },
  tomarFicha(ficha: Ficha): MensajeCliente {
    return { tipo: TipoMensajeCliente.TOMAR_FICHA, payload: { ficha } };
  },
  intercambiarCentro(fichaCentro: Ficha): MensajeCliente {
    return {
      tipo: TipoMensajeCliente.INTERCAMBIAR_CENTRO,
      payload: { fichaCentro },
    };
  },
  intercambiarJugador(jugadorB: string): MensajeCliente {
    return {
      tipo: TipoMensajeCliente.INTERCAMBIAR_JUGADOR,
      payload: { jugadorB },
    };
  },
  solicitarCartas(objetivoId: string): MensajeCliente {
    return {
      tipo: TipoMensajeCliente.SOLICITAR_CARTAS,
      payload: { objetivoId },
    };
  },
} as const;

// ===========================================================================
// Mensajes SALIENTES (servidor → cliente)
// ===========================================================================

/** Tipos de mensaje que el Servidor_Local envía al cliente. */
export const TipoMensajeServidor = {
  /** Vista personalizada del estado autoritativo de la Partida. */
  ESTADO: 'ESTADO',
  /** Error de juego o genérico dirigido solo al emisor. */
  ERROR: 'ERROR',
  /** Respuesta a una solicitud de Cartas de Bolsillo. */
  CARTAS: 'CARTAS',
} as const;

/** Difusión del estado: el payload es la vista personalizada del Jugador. */
export interface MensajeEstado {
  tipo: typeof TipoMensajeServidor.ESTADO;
  payload: VistaPartida;
}

/** Error dirigido al emisor; nunca contiene datos privados de otros Jugadores. */
export interface MensajeError {
  tipo: typeof TipoMensajeServidor.ERROR;
  payload: { codigo?: string; mensaje: string };
}

/** Mensaje entrante genérico recibido por el canal WebSocket. */
export interface MensajeServidor {
  tipo: string;
  payload?: unknown;
}

/** Type guard: ¿es un mensaje de ESTADO con una VistaPartida en el payload? */
export function esMensajeEstado(m: MensajeServidor): m is MensajeEstado {
  return (
    m.tipo === TipoMensajeServidor.ESTADO &&
    typeof m.payload === 'object' &&
    m.payload !== null
  );
}

/** Type guard: ¿es un mensaje de ERROR con un texto en español? */
export function esMensajeError(m: MensajeServidor): m is MensajeError {
  if (m.tipo !== TipoMensajeServidor.ERROR) {
    return false;
  }
  const payload = m.payload;
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { mensaje?: unknown }).mensaje === 'string'
  );
}
