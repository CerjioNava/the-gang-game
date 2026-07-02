// Renderizado HTML de cartas para las vistas del cliente.
//
// Las caras y dorsos se dibujan con los SVG de src/cliente/assets/cartas
// (ver cartasSvg.ts). Se conservan las clases .carta/.carta--* para que el
// layout y las animaciones de volteo sigan funcionando.

import type { Carta, Palo } from '../../dominio/modelos';
import {
  DORSO_POR_DEFECTO,
  type Dorso,
  urlCarta,
  urlDorso,
} from './cartasSvg';

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

const SIMBOLO_PALO: Record<Palo, string> = {
  PICAS: 'de picas',
  CORAZONES: 'de corazones',
  DIAMANTES: 'de diamantes',
  TREBOLES: 'de tréboles',
};

/** Texto accesible de una carta, p. ej. "As de picas". */
function altCarta(carta: Carta): string {
  return `${etiquetaValor(carta.valor)} ${SIMBOLO_PALO[carta.palo]}`;
}

/** Escapa una URL o texto para atributos HTML entre comillas dobles. */
function escaparAttr(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Imagen SVG de la cara de una carta. */
function imgCarta(carta: Carta): string {
  return `<img class="carta__svg" src="${escaparAttr(urlCarta(carta))}" alt="${altCarta(carta)}" draggable="false" />`;
}

/** Imagen SVG del dorso de una carta. */
function imgDorso(dorso: Dorso = DORSO_POR_DEFECTO): string {
  return `<img class="carta__svg carta__svg--dorso" src="${escaparAttr(urlDorso(dorso))}" alt="Carta oculta" draggable="false" />`;
}

function claseExtra(variante: 'normal' | 'mini' | 'hero' | 'mesa'): string {
  if (variante === 'hero') return ' carta--hero';
  if (variante === 'mini') return ' carta--mini';
  if (variante === 'mesa') return ' carta--mesa';
  return '';
}

/** Renderiza una carta boca arriba (SVG). */
export function cartaHtml(
  carta: Carta,
  variante: 'normal' | 'mini' | 'hero' | 'mesa' = 'normal',
): string {
  const base = paloEsRojo(carta.palo) ? 'carta carta--roja' : 'carta carta--negra';
  return `<div class="${base}${claseExtra(variante)}">${imgCarta(carta)}</div>`;
}

/** Carta con animación de volteo (dorso → frente). */
export function cartaVolteoHtml(
  carta: Carta,
  variante: 'mini' | 'hero' = 'mini',
  revelada = false,
): string {
  const extra = claseExtra(variante);
  const base = paloEsRojo(carta.palo) ? 'carta carta--roja' : 'carta carta--negra';
  const claseVolteo = revelada ? 'carta-volteo carta-volteo--revelada' : 'carta-volteo';
  const volteoHero = variante === 'hero' ? ' carta-volteo--hero' : '';
  return `
    <div class="${claseVolteo}${volteoHero}">
      <div class="carta-volteo__inner">
        <div class="carta-volteo__cara carta-volteo__cara--dorso">
          <div class="carta carta--dorso${extra}" aria-hidden="true">${imgDorso()}</div>
        </div>
        <div class="carta-volteo__cara carta-volteo__cara--frente">
          <div class="${base}${extra}">${imgCarta(carta)}</div>
        </div>
      </div>
    </div>`;
}

/** Par de cartas ocultas (solo dorso) para el showdown antes de revelar. */
export function cartasOcultasVolteoHtml(variante: 'mini' | 'hero' = 'mini'): string {
  const extra = claseExtra(variante);
  const dorso = `<div class="carta carta--dorso${extra}" aria-label="Carta oculta">${imgDorso()}</div>`;
  return `<div class="cartas-fila${variante === 'hero' ? ' cartas-fila--hero' : ' cartas-fila--mini'}">${dorso}${dorso}</div>`;
}

/** Fila de cartas con volteo cuando ya están reveladas. */
export function cartasVolteoHtml(
  cartas: readonly Carta[],
  variante: 'mini' | 'hero' = 'mini',
  revelada = true,
): string {
  const claseExtraFila = variante === 'hero' ? ' cartas-fila--hero' : ' cartas-fila--mini';
  return `<div class="cartas-fila${claseExtraFila}">${cartas
    .map((c) => cartaVolteoHtml(c, variante, revelada))
    .join('')}</div>`;
}

/** Dorso de carta (SVG). */
export function dorsoCartaHtml(variante: 'mini' | 'hero' = 'mini'): string {
  const extra = claseExtra(variante);
  return `<div class="carta carta--dorso${extra}" aria-label="Carta oculta">${imgDorso()}</div>`;
}

/** Fila de cartas; `mini`/`hero`/`mesa` ajustan el tamaño en mesa. */
export function cartasFilaHtml(
  cartas: readonly Carta[],
  miniOrVariante: boolean | 'normal' | 'mini' | 'hero' | 'mesa' = false,
): string {
  const variante =
    typeof miniOrVariante === 'boolean'
      ? miniOrVariante
        ? 'mini'
        : 'normal'
      : miniOrVariante;
  const claseExtraFila =
    variante === 'mini'
      ? ' cartas-fila--mini'
      : variante === 'hero'
        ? ' cartas-fila--hero'
        : variante === 'mesa'
          ? ' cartas-fila--mesa'
          : '';
  return `<div class="cartas-fila${claseExtraFila}">${cartas
    .map((c) => cartaHtml(c, variante === 'normal' ? 'normal' : variante))
    .join('')}</div>`;
}
