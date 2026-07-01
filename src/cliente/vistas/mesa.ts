// Vista de la MESA DE JUEGO del Cliente_Jugador (fase EN_CURSO).
//
// _Requirements: 6.6, 10.1, 10.2, 10.5, 11.1, 11.2_

import type { EstadoCliente } from '../estado';
import { actualizarMesa } from './mesa/mesaActualizar';
import type { AccionesMesa } from './mesa/tipos';

export type { AccionesMesa } from './mesa/tipos';

/**
 * Renderiza o actualiza la mesa de juego dentro de `contenedor`.
 * Usa parches incrementales cuando la estructura del Golpe no cambia.
 */
export function renderizarMesa(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesMesa,
): void {
  actualizarMesa(contenedor, estado, acciones);
}
