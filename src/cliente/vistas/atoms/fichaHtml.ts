import type { ColorFicha, Ficha } from '../../protocolo';
import { COLORES_FICHA } from '../../../dominio/modelos';

/** Ficha no interactiva (insignia junto al asiento o en showdown). */
export function fichaInsigniaHtml(ficha: Ficha): string {
  const color = ficha.color.toLowerCase();
  return `<span class="ficha ficha--${color}" data-animate-key="f-${ficha.color}-${ficha.estrellas}" title="Ficha ${ficha.estrellas}">${ficha.estrellas}</span>`;
}

/**
 * Cuatro ranuras fijas (una por ronda/color) bajo el asiento del jugador.
 * Las vacías se muestran como círculos; al tomar ficha, la ranura correspondiente se rellena.
 */
export function ranurasFichasJugadorHtml(
  fichas: readonly Ficha[],
  colorActivo: ColorFicha,
): string {
  const porColor = new Map(fichas.map((ficha) => [ficha.color, ficha]));

  const ranuras = COLORES_FICHA.map((color) => {
    const ficha = porColor.get(color);
    if (ficha !== undefined) {
      return `<span class="ficha-ranura ficha-ranura--llena ficha-ranura--${color.toLowerCase()}">${fichaInsigniaHtml(ficha)}</span>`;
    }

    const activa = color === colorActivo ? ' ficha-ranura--activa' : '';
    return `<span class="ficha-ranura ficha-ranura--vacia ficha-ranura--${color.toLowerCase()}${activa}" aria-label="Espacio ficha ${NOMBRE_COLOR_FICHA[color]}" title="Ficha ${NOMBRE_COLOR_FICHA[color]}"></span>`;
  }).join('');

  return `<div class="asiento__ranuras-fichas" aria-label="Fichas por ronda">${ranuras}</div>`;
}

/** Botón circular del pool central (tomar / intercambiar). */
export function fichaBotonHtml(
  ficha: Ficha,
  accion: 'TOMAR_FICHA' | 'INTERCAMBIAR_CENTRO',
  etiquetaAccion: string,
): string {
  const color = ficha.color.toLowerCase();
  return `
    <button
      type="button"
      class="ficha ficha--${color} ficha-boton"
      data-accion="${accion}"
      data-color="${ficha.color}"
      data-estrellas="${ficha.estrellas}"
      title="${etiquetaAccion} ficha ${ficha.estrellas}"
      aria-label="${etiquetaAccion} ficha ${color} ${ficha.estrellas}"
    >
      <span class="ficha-boton__valor">${ficha.estrellas}</span>
    </button>`;
}

/** Fichas del pool en solo lectura (espectador). */
export function fichasSoloLecturaHtml(fichas: readonly Ficha[]): string {
  return `<div class="fichas-fila fichas-fila--solo-lectura">${fichas
    .map(fichaInsigniaHtml)
    .join('')}</div>`;
}

export const NOMBRE_COLOR_FICHA: Record<ColorFicha, string> = {
  BLANCO: 'blancas',
  AMARILLO: 'amarillas',
  NARANJA: 'naranjas',
  ROJO: 'rojas',
};

/** Indicador de color de ronda activa (sin valor numérico). */
export function indicadorColorFichaHtml(color: ColorFicha): string {
  return `<span class="ficha ficha--indicador ficha--${color.toLowerCase()}" title="Fichas ${NOMBRE_COLOR_FICHA[color]}" aria-hidden="true"></span>`;
}

/** Ficha de orden en showdown (roja = revelado, verde = fuerza correcta). */
export function fichaOrdenShowdownHtml(estrellas: number, tipo: 'rojo' | 'verde'): string {
  const titulo = tipo === 'rojo' ? 'Orden revelado' : 'Orden por fuerza';
  return `<span class="ficha ficha--${tipo} ficha--orden-showdown" title="${titulo} ${estrellas}" aria-label="${titulo} ${estrellas}">${estrellas}</span>`;
}
