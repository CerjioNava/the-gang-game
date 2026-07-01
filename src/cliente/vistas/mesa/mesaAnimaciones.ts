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
  mesa.querySelectorAll<HTMLElement>('.asiento').forEach((asiento, indice) => {
    asiento.animate(
      [
        { opacity: 0, transform: 'translate(-50%, calc(-50% + 8px))' },
        { opacity: 1, transform: 'translate(-50%, -50%)' },
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
