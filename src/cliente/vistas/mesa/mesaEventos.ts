import type { ColorFicha, Ficha } from '../../protocolo';
import type { AccionesMesa } from './tipos';

const CONTENEDORES_ENLAZADOS = new WeakSet<HTMLElement>();

/** Recordatorio mientras se prepara el Golpe. */
export function recordatorioEsperaHtml(): string {
  return `
    <section class="mesa-poker">
      <div class="recordatorio" role="note">
        <strong>Regla de oro de la banda:</strong> está prohibido revelar, insinuar
        o discutir vuestras Cartas de Bolsillo. No se permite el bluff. Coordinad el
        golpe únicamente con vuestras Fichas.
      </div>
      <p class="mesa-poker__espera">Preparando el Golpe…</p>
    </section>`;
}

function leerFicha(boton: HTMLElement): Ficha | null {
  const color = boton.dataset['color'] as ColorFicha | undefined;
  const estrellasTxt = boton.dataset['estrellas'];
  if (color === undefined || estrellasTxt === undefined) {
    return null;
  }
  const valor = Number.parseInt(estrellasTxt, 10);
  if (Number.isNaN(valor)) {
    return null;
  }
  return { color, estrellas: valor };
}

/**
 * Delegación de eventos en la mesa (una sola suscripción por contenedor).
 * Sobrevive a parches incrementales del DOM.
 */
export function enlazarEventosMesa(contenedor: HTMLElement, acciones: AccionesMesa): void {
  if (CONTENEDORES_ENLAZADOS.has(contenedor)) {
    return;
  }
  CONTENEDORES_ENLAZADOS.add(contenedor);

  contenedor.addEventListener('click', (evento) => {
    const objetivo = evento.target as HTMLElement;
    const boton = objetivo.closest<HTMLButtonElement>('button');
    if (boton === null || !contenedor.contains(boton)) {
      return;
    }

    const accion = boton.dataset['accion'];
    if (accion === 'TOMAR_FICHA' || accion === 'INTERCAMBIAR_CENTRO') {
      const ficha = leerFicha(boton);
      if (ficha === null) {
        return;
      }
      if (accion === 'TOMAR_FICHA') {
        acciones.tomarFicha(ficha);
      } else {
        acciones.intercambiarCentro(ficha);
      }
      return;
    }

    if (accion === 'INTERCAMBIAR_JUGADOR') {
      const jugadorB = boton.dataset['jugador'];
      if (jugadorB !== undefined && jugadorB.length > 0) {
        acciones.intercambiarJugador(jugadorB);
      }
      return;
    }

    if (boton.id === 'boton-avanzar') {
      acciones.avanzar();
      return;
    }
    if (boton.id === 'boton-revelar-showdown') {
      acciones.revelarShowdown();
      return;
    }
    if (boton.id === 'boton-resolver') {
      acciones.resolverShowdown();
      return;
    }
    if (boton.id === 'boton-terminar-partida') {
      acciones.terminarPartida();
    }
  });
}
