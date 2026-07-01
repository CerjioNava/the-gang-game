// Renderizado HTML de cartas para las vistas del cliente.

import type { Carta, Palo } from '../../dominio/modelos';

/** Símbolo del palo de una carta (♠ ♥ ♦ ♣). */
const SIMBOLO_PALO: Record<Palo, string> = {
  PICAS: '♠',
  CORAZONES: '♥',
  DIAMANTES: '♦',
  TREBOLES: '♣',
};

function paloEsRojo(palo: Palo): boolean {
  return palo === 'CORAZONES' || palo === 'DIAMANTES';
}

/** Texto del valor de una carta: 2..10 y figuras J/Q/K/A. */
export function etiquetaValor(valor: number): string {
  switch (valor) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    default:
      return String(valor);
  }
}

/** Renderiza una carta boca arriba con su valor y palo. */
export function cartaHtml(carta: Carta): string {
  const clase = paloEsRojo(carta.palo) ? 'carta carta--roja' : 'carta carta--negra';
  return `
    <div class="${clase}">
      <span class="carta__valor">${etiquetaValor(carta.valor)}</span>
      <span class="carta__palo">${SIMBOLO_PALO[carta.palo]}</span>
    </div>`;
}

/** Fila de cartas; `mini` usa el tamaño compacto de mesa y ranking. */
export function cartasFilaHtml(cartas: readonly Carta[], mini = false): string {
  const claseExtra = mini ? ' cartas-fila--mini' : '';
  return `<div class="cartas-fila${claseExtra}">${cartas.map(cartaHtml).join('')}</div>`;
}
