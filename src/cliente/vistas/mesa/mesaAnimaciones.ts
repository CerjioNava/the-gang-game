import type { Ficha } from '../../../dominio/modelos';
import type { MovimientoFicha, UbicacionFicha } from './mesaFichasDiff';

/** Indica si el usuario prefiere menos animación. */
export function animacionesReducidas(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Pulso breve sobre un nodo (marcador, toast). */
export function animarPulso(elemento: Element): void {
  if (animacionesReducidas()) {
    return;
  }
  elemento.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.08)' },
      { transform: 'scale(1)' },
    ],
    { duration: 320, easing: 'ease-out' },
  );
}

/** Entrada dramática del bloque de resultado de showdown en la mesa. */
export function animarEntradaShowdownMesa(elemento: Element): void {
  if (animacionesReducidas()) {
    return;
  }
  const banner = elemento.querySelector('.showdown-mesa__banner');
  if (banner !== null) {
    banner.animate(
      [
        { opacity: 0, transform: 'scale(0.88)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }
  elemento.querySelectorAll('.showdown-mesa__fila').forEach((fila, indice) => {
    fila.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 360, delay: 120 + indice * 80, easing: 'ease-out' },
    );
  });
}

/** Entrada suave para cartas o fichas nuevas. */
export function animarEntrada(elemento: Element): void {
  if (animacionesReducidas()) {
    return;
  }
  elemento.animate(
    [
      { opacity: 0, transform: 'translateY(10px) scale(0.94)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  );
}

/**
 * Anima nodos cuyo `data-animate-key` no estaba en el conjunto previo.
 * Devuelve el nuevo conjunto de claves.
 */
export function animarNovedades(
  contenedor: ParentNode,
  selector: string,
  clavesPrevias: ReadonlySet<string>,
): Set<string> {
  const clavesActuales = new Set<string>();
  contenedor.querySelectorAll<HTMLElement>(selector).forEach((nodo) => {
    const clave = nodo.dataset['animateKey'];
    if (clave === undefined || clave.length === 0) {
      return;
    }
    clavesActuales.add(clave);
    if (!clavesPrevias.has(clave)) {
      animarEntrada(nodo);
    }
  });
  return clavesActuales;
}

/** Entrada inicial de la mesa tras montaje completo. */
export function animarEntradaMesa(mesa: HTMLElement): void {
  if (animacionesReducidas()) {
    return;
  }
  const felt = mesa.querySelector('.mesa-poker__felt');
  if (felt !== null) {
    felt.animate(
      [{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 340, easing: 'ease-out' },
    );
  }
  mesa.querySelectorAll<HTMLElement>('.asiento--local').forEach((asiento, indice) => {
    asiento.animate(
      [
        { opacity: 0, transform: 'translate(-50%, calc(-50% + 8px))' },
        { opacity: 1, transform: 'translate(-50%, -50%)' },
      ],
      { duration: 280, delay: indice * 40, easing: 'ease-out' },
    );
  });
  mesa.querySelectorAll<HTMLElement>('.mesa-poker__rivales .asiento').forEach((asiento, indice) => {
    asiento.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 280, delay: indice * 40, easing: 'ease-out' },
    );
  });
}

/** Volteo de cartas al revelar un jugador en el Showdown. */
export function animarVolteoShowdown(mesa: ParentNode, jugadorId: string): void {
  const asiento = mesa.querySelector<HTMLElement>(`.asiento[data-jugador-id="${jugadorId}"]`);
  if (asiento === null) {
    return;
  }
  asiento.querySelectorAll<HTMLElement>('.carta-volteo:not(.carta-volteo--revelada)').forEach((carta) => {
    carta.classList.add('carta-volteo--revelada');
    if (animacionesReducidas()) {
      return;
    }
    const inner = carta.querySelector('.carta-volteo__inner');
    if (inner !== null) {
      inner.animate(
        [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
        { duration: 560, easing: 'ease-in-out', fill: 'forwards' },
      );
    }
  });
}

function selectorFicha(ficha: Ficha): string {
  return `[data-animate-key="f-${ficha.color}-${ficha.estrellas}"]`;
}

/** Localiza un elemento de ficha en la mesa según su ubicación. */
export function elementoFichaEnUbicacion(
  mesa: ParentNode,
  ubicacion: UbicacionFicha,
  ficha: Ficha,
): HTMLElement | null {
  const sel = selectorFicha(ficha);
  if (ubicacion === 'centro') {
    return mesa.querySelector<HTMLElement>(`.mesa-poker__pool ${sel}`);
  }
  return mesa.querySelector<HTMLElement>(
    `.asiento[data-jugador-id="${ubicacion.jugadorId}"] .asiento__ranuras-fichas ${sel}`,
  );
}

/** Anima una ficha volando de un rectángulo origen a uno destino. */
export async function animarMovimientoFicha(
  origen: DOMRect,
  destino: DOMRect,
  ficha: Ficha,
): Promise<void> {
  if (animacionesReducidas()) {
    return;
  }

  const ghost = document.createElement('span');
  ghost.className = `ficha-ghost ficha ficha--${ficha.color.toLowerCase()}`;
  ghost.textContent = String(ficha.estrellas);
  const tamOrig = Math.max(origen.width, origen.height, 36);
  const tamDest = Math.max(destino.width, destino.height, 36);
  ghost.style.width = `${tamOrig}px`;
  ghost.style.height = `${tamOrig}px`;
  ghost.style.left = `${origen.left + origen.width / 2 - tamOrig / 2}px`;
  ghost.style.top = `${origen.top + origen.height / 2 - tamOrig / 2}px`;
  document.body.appendChild(ghost);

  const cxO = origen.left + origen.width / 2;
  const cyO = origen.top + origen.height / 2;
  const cxD = destino.left + destino.width / 2;
  const cyD = destino.top + destino.height / 2;
  const dx = cxD - cxO;
  const dy = cyD - cyO;
  const escala = tamDest / tamOrig;

  try {
    await ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${escala})`, opacity: 1 },
      ],
      { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    ).finished;
  } finally {
    ghost.remove();
  }
}

/** Anima todos los movimientos de fichas detectados tras un parche de mesa. */
export async function animarMovimientosFichas(
  mesa: ParentNode,
  movimientos: readonly MovimientoFicha[],
  rectsOrigen: ReadonlyMap<string, DOMRect>,
): Promise<void> {
  if (animacionesReducidas() || movimientos.length === 0) {
    return;
  }

  const ocultos: HTMLElement[] = [];

  for (const mov of movimientos) {
    const destEl = elementoFichaEnUbicacion(mesa, mov.destino, mov.ficha);
    if (destEl !== null) {
      destEl.style.opacity = '0';
      ocultos.push(destEl);
    }
  }

  await Promise.all(
    movimientos.map(async (mov) => {
      const clave = `f-${mov.ficha.color}-${mov.ficha.estrellas}`;
      const origRect = rectsOrigen.get(clave);
      const destEl = elementoFichaEnUbicacion(mesa, mov.destino, mov.ficha);
      if (origRect === undefined || destEl === null) {
        return;
      }
      const destRect = destEl.getBoundingClientRect();
      await animarMovimientoFicha(origRect, destRect, mov.ficha);
    }),
  );

  for (const el of ocultos) {
    el.style.opacity = '';
  }
}
