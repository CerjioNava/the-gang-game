import type { Ficha } from '../../protocolo';

/** Acciones que la vista de la mesa puede solicitar a la capa de aplicación. */
export interface AccionesMesa {
  tomarFicha(ficha: Ficha): void;
  intercambiarCentro(fichaCentro: Ficha): void;
  intercambiarJugador(jugadorB: string): void;
  avanzar(): void;
  resolverShowdown(): void;
  revelarShowdown(): void;
  terminarPartida(): void;
}
