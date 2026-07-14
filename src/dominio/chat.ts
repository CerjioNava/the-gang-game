// Lógica pura del chat de la Partida (sin I/O).
//
// El chat vive en el estado autoritativo (`EstadoPartida.historialChat`) y viaja
// a los clientes dentro de la VistaPartida mediante la difusión existente. Este
// módulo solo se encarga de sanear el texto y de acumular mensajes con un tope.

import type { EstadoPartida, MensajeChat } from "./modelos";

/** Longitud máxima permitida para un mensaje de chat. */
export const MAX_LONGITUD_MENSAJE = 500;

/** Número máximo de mensajes conservados en el historial. */
export const MAX_MENSAJES_CHAT = 200;

/**
 * Sanea el texto de un mensaje de chat: recorta espacios, rechaza cadenas vacías
 * y limita la longitud a `MAX_LONGITUD_MENSAJE`. Devuelve null si no queda texto
 * válido.
 */
export function sanearTextoChat(texto: unknown): string | null {
  if (typeof texto !== "string") {
    return null;
  }
  const limpio = texto.trim();
  if (limpio.length === 0) {
    return null;
  }
  return limpio.slice(0, MAX_LONGITUD_MENSAJE);
}

/**
 * Agrega un mensaje al historial de chat de forma inmutable, conservando solo
 * los últimos `MAX_MENSAJES_CHAT` mensajes.
 */
export function agregarMensajeChat(
  estado: EstadoPartida,
  mensaje: MensajeChat,
): EstadoPartida {
  const historialPrevio = estado.historialChat ?? [];
  const historialChat = [...historialPrevio, mensaje].slice(-MAX_MENSAJES_CHAT);
  return { ...estado, historialChat };
}
