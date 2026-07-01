import type { ColorFicha, Ficha } from '../../protocolo';

/** Ficha no interactiva (insignia junto al asiento o en showdown). */
export function fichaInsigniaHtml(ficha: Ficha): string {
  const color = ficha.color.toLowerCase();
  return `<span class="ficha ficha--${color}" title="Ficha ${ficha.estrellas}">${ficha.estrellas}</span>`;
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
