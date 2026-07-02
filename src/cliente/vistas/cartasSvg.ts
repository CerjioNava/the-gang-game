// Mapa de assets SVG para cartas, dorsos y mesa.
//
// Los SVG viven en src/cliente/assets/cartas con nombres tipo "AS", "10H",
// "KC", "2D", además de "BACK" (dorso) y "TABLE" (tapete).
// Vite resuelve cada archivo a una URL final vía import.meta.glob.

import type { Carta, Palo } from "../../dominio/modelos";
import backUrl from "../assets/cartas/BACK.svg?url";

/** Inicial de tipo usada en los nombres de archivo (H, D, C, S). */
const INICIAL_PALO: Record<Palo, string> = {
  PICAS: "S",
  CORAZONES: "H",
  DIAMANTES: "D",
  TREBOLES: "C",
};

/** Etiqueta del valor tal y como aparece en el nombre del archivo. */
function etiquetaValorArchivo(valor: number): string {
  switch (valor) {
    case 14:
      return "A";
    case 13:
      return "K";
    case 12:
      return "Q";
    case 11:
      return "J";
    default:
      return String(valor);
  }
}

/** Código de archivo de una carta, p. ej. "AS", "10H", "KC". */
export function codigoCarta(carta: Carta): string {
  return `${etiquetaValorArchivo(carta.valor)}${INICIAL_PALO[carta.palo]}`;
}

// Carga ansiosa de todas las URLs de los SVG (clave = ruta relativa).
const modulos = import.meta.glob("../assets/cartas/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Mapa nombre-de-archivo (sin extensión) → URL resuelta por Vite. */
const URL_POR_NOMBRE: Record<string, string> = {};
for (const [ruta, url] of Object.entries(modulos)) {
  const nombre = ruta
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.svg$/, "");
  if (nombre !== undefined) {
    URL_POR_NOMBRE[nombre] = url;
  }
}

// Importación explícita para que Vite no elimine el dorso en el bundle.
URL_POR_NOMBRE["BACK"] = backUrl;

/** URL del SVG de la cara de una carta. */
export function urlCarta(carta: Carta): string {
  return URL_POR_NOMBRE[codigoCarta(carta)] ?? "";
}

/** Dorso disponible. */
export type Dorso = "BACK";

/** Dorso por defecto usado en la mesa. */
export const DORSO_POR_DEFECTO: Dorso = "BACK";

/** URL del SVG de un dorso de carta. */
export function urlDorso(dorso: Dorso = DORSO_POR_DEFECTO): string {
  return URL_POR_NOMBRE[dorso] ?? "";
}

/** URL del SVG del tapete/mesa. */
export function urlMesa(): string {
  return URL_POR_NOMBRE["TABLE"] ?? "";
}
