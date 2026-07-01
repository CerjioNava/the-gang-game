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
export function cartaHtml(carta: Carta, variante: 'normal' | 'mini' | 'hero' = 'normal'): string {
  const base = paloEsRojo(carta.palo) ? 'carta carta--roja' : 'carta carta--negra';
  const extra =
    variante === 'hero' ? ' carta--hero' : variante === 'mini' ? ' carta--mini' : '';
  return `
    <div class="${base}${extra}">
      <span class="carta__valor">${etiquetaValor(carta.valor)}</span>
      <span class="carta__palo">${SIMBOLO_PALO[carta.palo]}</span>
    </div>`;
}

/** Carta con animación de volteo (dorso → frente). */
export function cartaVolteoHtml(
  carta: Carta,
  variante: 'mini' | 'hero' = 'mini',
  revelada = false,
): string {
  const extra = variante === 'hero' ? ' carta--hero' : ' carta--mini';
  const base = paloEsRojo(carta.palo) ? 'carta carta--roja' : 'carta carta--negra';
  const claseVolteo = revelada ? 'carta-volteo carta-volteo--revelada' : 'carta-volteo';
  return `
    <div class="${claseVolteo}${extra === ' carta--hero' ? ' carta-volteo--hero' : ''}">
      <div class="carta-volteo__inner">
        <div class="carta-volteo__cara carta-volteo__cara--dorso">
          <div class="carta carta--dorso${extra}" aria-hidden="true">★</div>
        </div>
        <div class="carta-volteo__cara carta-volteo__cara--frente">
          <div class="${base}${extra}">
            <span class="carta__valor">${etiquetaValor(carta.valor)}</span>
            <span class="carta__palo">${SIMBOLO_PALO[carta.palo]}</span>
          </div>
        </div>
      </div>
    </div>`;
}

/** Par de cartas ocultas (solo dorso) para el showdown antes de revelar. */
export function cartasOcultasVolteoHtml(variante: 'mini' | 'hero' = 'mini'): string {
  const extra = variante === 'hero' ? ' carta--hero' : ' carta--mini';
  const dorso = `<div class="carta carta--dorso${extra}" aria-label="Carta oculta">★</div>`;
  return `<div class="cartas-fila${variante === 'hero' ? ' cartas-fila--hero' : ' cartas-fila--mini'}">${dorso}${dorso}</div>`;
}

/** Fila de cartas con volteo cuando ya están reveladas. */
export function cartasVolteoHtml(
  cartas: readonly Carta[],
  variante: 'mini' | 'hero' = 'mini',
  revelada = true,
): string {
  const claseExtra =
    variante === 'hero' ? ' cartas-fila--hero' : ' cartas-fila--mini';
  return `<div class="cartas-fila${claseExtra}">${cartas
    .map((c) => cartaVolteoHtml(c, variante, revelada))
    .join('')}</div>`;
}

/** Dorso de carta. */
export function dorsoCartaHtml(variante: 'mini' | 'hero' = 'mini'): string {
  const extra = variante === 'hero' ? ' carta--hero' : ' carta--mini';
  return `<div class="carta carta--dorso${extra}" aria-label="Carta oculta">★</div>`;
}

/** Fila de cartas; `mini`/`hero` ajustan el tamaño en mesa. */
export function cartasFilaHtml(
  cartas: readonly Carta[],
  miniOrVariante: boolean | 'normal' | 'mini' | 'hero' = false,
): string {
  const variante =
    typeof miniOrVariante === 'boolean'
      ? miniOrVariante
        ? 'mini'
        : 'normal'
      : miniOrVariante;
  const claseExtra =
    variante === 'mini'
      ? ' cartas-fila--mini'
      : variante === 'hero'
        ? ' cartas-fila--hero'
        : '';
  return `<div class="cartas-fila${claseExtra}">${cartas
    .map((c) => cartaHtml(c, variante === 'normal' ? 'normal' : variante))
    .join('')}</div>`;
}
