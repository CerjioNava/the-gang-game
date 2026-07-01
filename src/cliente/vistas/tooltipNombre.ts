// Tooltip de descripción para alias de jugadores y espectadores.

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renderiza un nombre con burbuja de descripción al pasar el cursor o enfocar.
 * Si no hay descripción, devuelve solo el nombre escapado.
 */
export function nombreConTooltipHtml(nombre: string, descripcion?: string | null): string {
  const textoNombre = escapar(nombre);
  const desc = descripcion?.trim();
  if (desc === undefined || desc.length === 0) {
    return textoNombre;
  }
  return `<span class="alias-tooltip" tabindex="0">
    <span class="alias-tooltip__texto">${textoNombre}</span>
    <span class="alias-tooltip__burbuja" role="tooltip">${escapar(desc)}</span>
  </span>`;
}
