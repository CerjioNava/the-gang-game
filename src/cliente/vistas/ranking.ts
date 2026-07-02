// Panel consultable del Ranking_de_Manos del Cliente_Jugador.
//
// Muestra las DIEZ categorías de póker ordenadas de mayor a menor, con su nombre
// en español, una breve descripción y un ejemplo visual de cinco cartas,
// respetando el orden propio de The Gang (Full House < Póker < Color). Se monta
// como un elemento GLOBAL: un botón fijo "Ranking de manos" que abre/cierra un
// panel superpuesto, disponible durante toda la Partida.
//
// Todos los textos están en español con temática de ladrones.
//
// _Requirements: 11.3_

import { CategoriaMano, type Carta } from "../../dominio";
import { cartasFilaHtml } from "./cartasHtml";

/**
 * Nombre en español de cada categoría del Ranking_de_Manos. Se reutiliza en el
 * Showdown para mostrar la categoría de la mano de cada Jugador.
 */
export const NOMBRE_CATEGORIA: Record<CategoriaMano, string> = {
  [CategoriaMano.CARTA_ALTA]: "Carta Alta",
  [CategoriaMano.PAR]: "Par",
  [CategoriaMano.DOS_PARES]: "Dos Pares",
  [CategoriaMano.TRIO]: "Trío",
  [CategoriaMano.ESCALERA]: "Escalera",
  [CategoriaMano.FULL_HOUSE]: "Full House",
  [CategoriaMano.POKER]: "Póker",
  [CategoriaMano.COLOR]: "Color",
  [CategoriaMano.ESCALERA_COLOR]: "Escalera de Color",
  [CategoriaMano.ESCALERA_REAL]: "Escalera Real",
};

/** Una entrada del Ranking_de_Manos: categoría, descripción y mano de ejemplo. */
interface EntradaRanking {
  categoria: CategoriaMano;
  descripcion: string;
  ejemplo: readonly Carta[];
}

/** Construye una carta de forma concisa para los ejemplos del ranking. */
function c(valor: number, palo: Carta["palo"]): Carta {
  return { valor, palo };
}

/**
 * Ejemplos canónicos de cinco cartas por categoría. Cada mano ilustra la
 * combinación sin ambigüedad (p. ej. escalera con palos mezclados, color sin
 * secuencia consecutiva).
 */
export const EJEMPLOS_CATEGORIA: Record<CategoriaMano, readonly Carta[]> = {
  [CategoriaMano.CARTA_ALTA]: [
    c(14, "PICAS"),
    c(13, "CORAZONES"),
    c(11, "DIAMANTES"),
    c(9, "TREBOLES"),
    c(7, "PICAS"),
  ],
  [CategoriaMano.PAR]: [
    c(13, "PICAS"),
    c(13, "CORAZONES"),
    c(11, "DIAMANTES"),
    c(9, "TREBOLES"),
    c(7, "PICAS"),
  ],
  [CategoriaMano.DOS_PARES]: [
    c(13, "PICAS"),
    c(13, "CORAZONES"),
    c(11, "DIAMANTES"),
    c(11, "TREBOLES"),
    c(9, "PICAS"),
  ],
  [CategoriaMano.TRIO]: [
    c(13, "PICAS"),
    c(13, "CORAZONES"),
    c(13, "DIAMANTES"),
    c(11, "TREBOLES"),
    c(9, "PICAS"),
  ],
  [CategoriaMano.ESCALERA]: [
    c(9, "PICAS"),
    c(10, "CORAZONES"),
    c(11, "DIAMANTES"),
    c(12, "TREBOLES"),
    c(13, "PICAS"),
  ],
  [CategoriaMano.FULL_HOUSE]: [
    c(13, "PICAS"),
    c(13, "CORAZONES"),
    c(13, "DIAMANTES"),
    c(12, "TREBOLES"),
    c(12, "PICAS"),
  ],
  [CategoriaMano.POKER]: [
    c(14, "PICAS"),
    c(14, "CORAZONES"),
    c(14, "DIAMANTES"),
    c(14, "TREBOLES"),
    c(13, "PICAS"),
  ],
  [CategoriaMano.COLOR]: [
    c(2, "DIAMANTES"),
    c(5, "DIAMANTES"),
    c(7, "DIAMANTES"),
    c(9, "DIAMANTES"),
    c(11, "DIAMANTES"),
  ],
  [CategoriaMano.ESCALERA_COLOR]: [
    c(9, "CORAZONES"),
    c(10, "CORAZONES"),
    c(11, "CORAZONES"),
    c(12, "CORAZONES"),
    c(13, "CORAZONES"),
  ],
  [CategoriaMano.ESCALERA_REAL]: [
    c(10, "PICAS"),
    c(11, "PICAS"),
    c(12, "PICAS"),
    c(13, "PICAS"),
    c(14, "PICAS"),
  ],
};

/**
 * Las diez categorías ordenadas de MAYOR a MENOR según el Ranking_de_Manos de
 * The Gang (criterio 11.3). El orden del array es el de presentación en el
 * panel: de la mano más fuerte a la más débil.
 */
export const CATEGORIAS_RANKING: readonly EntradaRanking[] = [
  {
    categoria: CategoriaMano.ESCALERA_REAL,
    descripcion: "Escalera de color del 10 al As: el golpe perfecto.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.ESCALERA_REAL],
  },
  {
    categoria: CategoriaMano.ESCALERA_COLOR,
    descripcion: "Cinco cartas consecutivas del mismo palo.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.ESCALERA_COLOR],
  },
  {
    categoria: CategoriaMano.COLOR,
    descripcion: "Cinco cartas del mismo palo, no consecutivas.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.COLOR],
  },
  {
    categoria: CategoriaMano.POKER,
    descripcion: "Cuatro cartas del mismo valor.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.POKER],
  },
  {
    categoria: CategoriaMano.FULL_HOUSE,
    descripcion: "Un trío y una pareja juntos.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.FULL_HOUSE],
  },
  {
    categoria: CategoriaMano.ESCALERA,
    descripcion: "Cinco cartas consecutivas de palos variados.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.ESCALERA],
  },
  {
    categoria: CategoriaMano.TRIO,
    descripcion: "Tres cartas del mismo valor.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.TRIO],
  },
  {
    categoria: CategoriaMano.DOS_PARES,
    descripcion: "Dos parejas distintas.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.DOS_PARES],
  },
  {
    categoria: CategoriaMano.PAR,
    descripcion: "Dos cartas del mismo valor.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.PAR],
  },
  {
    categoria: CategoriaMano.CARTA_ALTA,
    descripcion: "Sin combinación; manda la carta más alta.",
    ejemplo: EJEMPLOS_CATEGORIA[CategoriaMano.CARTA_ALTA],
  },
];

const ID_BOTON = "ranking-boton";
const ID_OVERLAY = "ranking-overlay";
const CLASE_OVERLAY_VISIBLE = "ranking-overlay--visible";
const DURACION_CIERRE_MS = 300;

/** Construye el HTML de la lista ordenada de las diez categorías. */
function listaRankingHtml(): string {
  const filas = CATEGORIAS_RANKING.map((entrada, indice) => {
    const nombre = NOMBRE_CATEGORIA[entrada.categoria];
    return `
      <li class="ranking__item">
        <span class="ranking__posicion">${indice + 1}</span>
        <span class="ranking__detalle">
          <span class="ranking__nombre">${nombre}</span>
          <span class="ranking__descripcion">${entrada.descripcion}</span>
          <div class="ranking__ejemplo" aria-label="Ejemplo de ${nombre}">
            ${cartasFilaHtml(entrada.ejemplo, true)}
          </div>
        </span>
      </li>`;
  }).join("");

  return `<ol class="ranking__lista">${filas}</ol>`;
}

/** Abre el panel del Ranking_de_Manos. */
function abrirPanel(overlay: HTMLElement, boton: HTMLElement): void {
  overlay.hidden = false;
  overlay.classList.remove(CLASE_OVERLAY_VISIBLE);
  boton.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    overlay.classList.add(CLASE_OVERLAY_VISIBLE);
  });
}

/** Cierra el panel del Ranking_de_Manos. */
function cerrarPanel(overlay: HTMLElement, boton: HTMLElement): void {
  if (overlay.hidden) {
    return;
  }

  overlay.classList.remove(CLASE_OVERLAY_VISIBLE);
  boton.setAttribute("aria-expanded", "false");

  const panel = overlay.querySelector(".ranking-panel");
  const finalizar = (): void => {
    overlay.hidden = true;
  };

  if (panel === null) {
    finalizar();
    return;
  }

  const onFin = (evento: Event): void => {
    if (
      evento.target !== panel ||
      !(evento instanceof TransitionEvent) ||
      evento.propertyName !== "transform"
    ) {
      return;
    }
    panel.removeEventListener("transitionend", onFin);
    finalizar();
  };

  panel.addEventListener("transitionend", onFin);
  window.setTimeout(() => {
    if (overlay.hidden === false && !overlay.classList.contains(CLASE_OVERLAY_VISIBLE)) {
      panel.removeEventListener("transitionend", onFin);
      finalizar();
    }
  }, DURACION_CIERRE_MS);
}

/**
 * Monta el botón global "Ranking de manos" y su panel superpuesto.
 * Idempotente: si el botón ya existe en el documento no hace nada.
 * El botón puede ir en `contenedorBoton` (p. ej. footer del shell); el overlay
 * siempre se monta en `document.body`.
 */
export function montarRanking(contenedorBoton?: HTMLElement | null): void {
  const existente = document.getElementById(ID_BOTON);
  if (existente !== null) {
    const destino = contenedorBoton ?? document.body;
    if (existente.parentElement !== destino) {
      destino.appendChild(existente);
    }
    return;
  }

  const boton = document.createElement("button");
  boton.type = "button";
  boton.id = ID_BOTON;
  boton.className = "ranking-boton";
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-controls", ID_OVERLAY);
  boton.textContent = "Ranking de manos";

  const overlay = document.createElement("div");
  overlay.id = ID_OVERLAY;
  overlay.className = "ranking-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="ranking-overlay__fondo"></div>
    <aside class="ranking-panel" role="dialog" aria-modal="true" aria-labelledby="ranking-titulo">
      <header class="ranking-panel__cabecera">
        <h2 id="ranking-titulo">Ranking de manos</h2>
        <button type="button" class="ranking-panel__cerrar" aria-label="Cerrar el ranking">×</button>
      </header>
      <div class="ranking-panel__contenido">
        <p class="ranking-panel__intro">
          De la mano más fuerte a la más débil. Cada fila muestra un ejemplo visual.
          Recuerda el orden propio del golpe: el Full House vale menos que el Póker,
          y el Póker menos que el Color.
        </p>
        ${listaRankingHtml()}
      </div>
    </aside>`;

  boton.addEventListener("click", () => {
    if (overlay.hidden || !overlay.classList.contains(CLASE_OVERLAY_VISIBLE)) {
      abrirPanel(overlay, boton);
    } else {
      cerrarPanel(overlay, boton);
    }
  });

  // Cerrar al pulsar el fondo (fuera del panel) o el botón de cerrar.
  overlay.addEventListener("click", (evento) => {
    const objetivo = evento.target as HTMLElement;
    if (
      objetivo.classList.contains("ranking-overlay__fondo") ||
      objetivo.classList.contains("ranking-panel__cerrar")
    ) {
      cerrarPanel(overlay, boton);
    }
  });

  // Cerrar con la tecla Escape.
  document.addEventListener("keydown", (evento) => {
    if (
      evento.key === "Escape" &&
      !overlay.hidden &&
      overlay.classList.contains(CLASE_OVERLAY_VISIBLE)
    ) {
      cerrarPanel(overlay, boton);
    }
  });

  const destino = contenedorBoton ?? document.body;
  destino.appendChild(boton);
  document.body.appendChild(overlay);
}
