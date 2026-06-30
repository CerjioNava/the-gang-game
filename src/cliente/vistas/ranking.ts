// Panel consultable del Ranking_de_Manos del Cliente_Jugador.
//
// Muestra las DIEZ categorías de póker ordenadas de menor a mayor, con su nombre
// en español y una breve descripción, respetando el orden propio de The Gang
// (Full House < Póker < Color). Se monta como un elemento GLOBAL: un botón fijo
// "Ranking de manos" que abre/cierra un panel superpuesto, disponible durante
// toda la Partida (en el escondite, en la mesa y en el resultado final).
//
// Todos los textos están en español con temática de ladrones.
//
// _Requirements: 11.3_

import { CategoriaMano } from '../../dominio';

/**
 * Nombre en español de cada categoría del Ranking_de_Manos. Se reutiliza en el
 * Showdown para mostrar la categoría de la mano de cada Jugador.
 */
export const NOMBRE_CATEGORIA: Record<CategoriaMano, string> = {
  [CategoriaMano.CARTA_ALTA]: 'Carta Alta',
  [CategoriaMano.PAR]: 'Par',
  [CategoriaMano.DOS_PARES]: 'Dos Pares',
  [CategoriaMano.TRIO]: 'Trío',
  [CategoriaMano.ESCALERA]: 'Escalera',
  [CategoriaMano.FULL_HOUSE]: 'Full House',
  [CategoriaMano.POKER]: 'Póker',
  [CategoriaMano.COLOR]: 'Color',
  [CategoriaMano.ESCALERA_COLOR]: 'Escalera de Color',
  [CategoriaMano.ESCALERA_REAL]: 'Escalera Real',
};

/** Una entrada del Ranking_de_Manos: categoría, nombre y descripción breve. */
interface EntradaRanking {
  categoria: CategoriaMano;
  descripcion: string;
}

/**
 * Las diez categorías ordenadas de MENOR a MAYOR según el Ranking_de_Manos de
 * The Gang (criterio 11.3). El orden del array es exactamente el orden del
 * ranking, de la mano más débil a la más fuerte.
 */
export const CATEGORIAS_RANKING: readonly EntradaRanking[] = [
  { categoria: CategoriaMano.CARTA_ALTA, descripcion: 'Sin combinación; manda la carta más alta.' },
  { categoria: CategoriaMano.PAR, descripcion: 'Dos cartas del mismo valor.' },
  { categoria: CategoriaMano.DOS_PARES, descripcion: 'Dos parejas distintas.' },
  { categoria: CategoriaMano.TRIO, descripcion: 'Tres cartas del mismo valor.' },
  { categoria: CategoriaMano.ESCALERA, descripcion: 'Cinco cartas consecutivas de palos variados.' },
  { categoria: CategoriaMano.FULL_HOUSE, descripcion: 'Un trío y una pareja juntos.' },
  { categoria: CategoriaMano.POKER, descripcion: 'Cuatro cartas del mismo valor.' },
  { categoria: CategoriaMano.COLOR, descripcion: 'Cinco cartas del mismo palo, no consecutivas.' },
  { categoria: CategoriaMano.ESCALERA_COLOR, descripcion: 'Cinco cartas consecutivas del mismo palo.' },
  { categoria: CategoriaMano.ESCALERA_REAL, descripcion: 'Escalera de color del 10 al As: el golpe perfecto.' },
];

const ID_BOTON = 'ranking-boton';
const ID_OVERLAY = 'ranking-overlay';

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
        </span>
      </li>`;
  }).join('');

  return `<ol class="ranking__lista">${filas}</ol>`;
}

/** Abre el panel del Ranking_de_Manos. */
function abrirPanel(overlay: HTMLElement, boton: HTMLElement): void {
  overlay.hidden = false;
  boton.setAttribute('aria-expanded', 'true');
}

/** Cierra el panel del Ranking_de_Manos. */
function cerrarPanel(overlay: HTMLElement, boton: HTMLElement): void {
  overlay.hidden = true;
  boton.setAttribute('aria-expanded', 'false');
}

/**
 * Monta (una sola vez) el botón global "Ranking de manos" y su panel superpuesto
 * en el documento. Es idempotente: si ya está montado no hace nada, de modo que
 * sobrevive a los re-render de la SPA y permanece disponible durante toda la
 * Partida (criterio 11.3).
 */
export function montarRanking(): void {
  if (document.getElementById(ID_BOTON) !== null) {
    return;
  }

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.id = ID_BOTON;
  boton.className = 'ranking-boton';
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-controls', ID_OVERLAY);
  boton.textContent = 'Ranking de manos';

  const overlay = document.createElement('div');
  overlay.id = ID_OVERLAY;
  overlay.className = 'ranking-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="ranking-panel" role="dialog" aria-modal="true" aria-labelledby="ranking-titulo">
      <header class="ranking-panel__cabecera">
        <h2 id="ranking-titulo">Ranking de manos</h2>
        <button type="button" class="ranking-panel__cerrar" aria-label="Cerrar el ranking">×</button>
      </header>
      <p class="ranking-panel__intro">
        De la mano más débil a la más fuerte. Recuerda el orden propio del golpe:
        el Full House vale menos que el Póker, y el Póker menos que el Color.
      </p>
      ${listaRankingHtml()}
    </div>`;

  boton.addEventListener('click', () => {
    if (overlay.hidden) {
      abrirPanel(overlay, boton);
    } else {
      cerrarPanel(overlay, boton);
    }
  });

  // Cerrar al pulsar el fondo (fuera del panel) o el botón de cerrar.
  overlay.addEventListener('click', (evento) => {
    const objetivo = evento.target as HTMLElement;
    if (objetivo === overlay || objetivo.classList.contains('ranking-panel__cerrar')) {
      cerrarPanel(overlay, boton);
    }
  });

  // Cerrar con la tecla Escape.
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !overlay.hidden) {
      cerrarPanel(overlay, boton);
    }
  });

  document.body.appendChild(boton);
  document.body.appendChild(overlay);
}
