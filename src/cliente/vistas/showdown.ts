// Vista del SHOWDOWN y del RESULTADO FINAL del Cliente_Jugador.
//
// - `renderizarShowdown` muestra el revelado de las manos de TODOS los Jugadores
//   en el ORDEN del Showdown: ascendente por el valor en estrellas de su Ficha
//   roja (criterio 8.2). Para cada Jugador se muestra su nombre, su Ficha roja,
//   sus dos Cartas de Bolsillo reveladas junto a las Comunitarias, y la categoría
//   de su mejor mano en español, evaluada con el Evaluador_Manos del dominio.
//
// - `renderizarResultado` sustituye el marcador placeholder de la fase
//   FINALIZADA por una pantalla temática de victoria o derrota con el marcador de
//   Bóvedas doradas y Alarmas rojas (criterio 9.3).
//
// Todos los textos están en español con temática de ladrones y usan los términos
// del glosario (Golpe, Bóveda, Alarma, Ficha, Showdown).
//
// _Requirements: 8.2, 9.3_

import { evaluar, type ManoEvaluada } from '../../dominio';
import { BOLSILLO_OCULTO, type VistaGolpe, type VistaShowdownResuelto } from '../../dominio/proyeccion';
import type { Carta, JugadorVisible, Palo, VistaPartida } from '../protocolo';
import { estatusJugadorHtml } from './estatusJugador';
import { nombreConTooltipHtml } from './tooltipNombre';
import { NOMBRE_CATEGORIA } from './ranking';

// ===========================================================================
// Utilidades de presentación (sin lógica de reglas)
// ===========================================================================

/** Escapa texto para insertarlo de forma segura como contenido HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Símbolo del palo de una Carta (♠ ♥ ♦ ♣). */
const SIMBOLO_PALO: Record<Palo, string> = {
  PICAS: '♠',
  CORAZONES: '♥',
  DIAMANTES: '♦',
  TREBOLES: '♣',
};

/** Indica si el palo se pinta en rojo (corazones y diamantes). */
function paloEsRojo(palo: Palo): boolean {
  return palo === 'CORAZONES' || palo === 'DIAMANTES';
}

/** Texto del valor de una Carta: 2..10 y figuras J/Q/K/A. */
function etiquetaValor(valor: number): string {
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

/** Renderiza una Carta boca arriba con su valor y palo. */
function cartaHtml(carta: Carta): string {
  const clase = paloEsRojo(carta.palo) ? 'carta carta--roja' : 'carta carta--negra';
  return `
    <div class="${clase}">
      <span class="carta__valor">${etiquetaValor(carta.valor)}</span>
      <span class="carta__palo">${SIMBOLO_PALO[carta.palo]}</span>
    </div>`;
}

/** Pinta las estrellas de una Ficha (p. ej. "★★★"). */
function estrellas(n: number): string {
  return '★'.repeat(Math.max(0, n));
}

// ===========================================================================
// Orden del Showdown
// ===========================================================================

/** Un Jugador situado en el orden del Showdown junto a su Ficha roja. */
interface PosicionShowdown {
  jugador: JugadorVisible;
  /** Estrellas de la Ficha roja del Jugador (0 si, excepcionalmente, no la tiene). */
  estrellasRojas: number;
}

/**
 * Devuelve a los Jugadores ordenados ASCENDENTEMENTE por el valor en estrellas
 * de su Ficha roja, conforme al orden del Showdown (criterio 8.2). La Ficha roja
 * de cada Jugador se obtiene de `golpe.fichas.porJugador`.
 */
function ordenarPorFichaRoja(
  vista: VistaPartida,
  golpe: VistaGolpe,
): PosicionShowdown[] {
  const posiciones: PosicionShowdown[] = vista.jugadores.map((jugador) => {
    const susFichas = golpe.fichas.porJugador[jugador.id] ?? [];
    const fichaRoja = susFichas.find((f) => f.color === 'ROJO');
    return {
      jugador,
      estrellasRojas: fichaRoja?.estrellas ?? 0,
    };
  });
  posiciones.sort((a, b) => a.estrellasRojas - b.estrellasRojas);
  return posiciones;
}

// ===========================================================================
// Render del Showdown
// ===========================================================================

/**
 * Renderiza el revelado de manos del Showdown dentro de `contenedor`. Muestra a
 * cada Jugador en el orden ascendente de su Ficha roja, con sus Cartas de
 * Bolsillo reveladas y la categoría de su mejor mano en español.
 *
 * Se invoca cuando la Ronda activa del Golpe en curso es `SHOWDOWN`.
 */
export function renderizarShowdown(
  contenedor: HTMLElement,
  vista: VistaPartida,
): void {
  const golpe = vista.golpeActual;
  if (golpe === null || golpe.ronda !== 'SHOWDOWN') {
    contenedor.innerHTML = '';
    return;
  }

  const orden = ordenarPorFichaRoja(vista, golpe);
  const filas = orden
    .map((posicion) => filaShowdownHtml(posicion, golpe))
    .join('');

  contenedor.innerHTML = `
    <section class="bloque showdown">
      <h3>Showdown · revelado de manos</h3>
      <p class="showdown__ayuda">
        Las manos se descubren en orden ascendente de Ficha roja, de la de menor
        valor a la de mayor. El golpe sale bien si la fuerza no decrece al avanzar.
      </p>
      <ol class="showdown__lista">${filas}</ol>
    </section>`;
}

/**
 * Renderiza el Showdown ya resuelto con el resultado del Golpe (bóveda o alarma).
 * Persiste hasta que alguien mueve fichas en el siguiente Golpe.
 */
export function renderizarShowdownResuelto(
  contenedor: HTMLElement,
  vista: VistaPartida,
): void {
  const resuelto = vista.ultimoShowdownResuelto;
  if (resuelto === null) {
    contenedor.innerHTML = '';
    return;
  }

  const golpeVista: VistaGolpe = {
    numero: resuelto.numero,
    ronda: 'SHOWDOWN',
    comunitarias: resuelto.comunitarias,
    fichas: resuelto.fichas,
    confirmados: [],
  };

  const vistaOrden: VistaPartida = {
    ...vista,
    jugadores: resuelto.jugadores,
  };

  const orden = ordenarPorFichaRoja(vistaOrden, golpeVista);
  const filas = orden
    .map((posicion) => filaShowdownHtml(posicion, golpeVista))
    .join('');

  const bannerExito = resuelto.exito
    ? `<div class="showdown__resultado showdown__resultado--exito" role="status">
        <strong>¡Bóveda abierta!</strong> El Golpe ${resuelto.numero} fue un éxito para la banda.
      </div>`
    : `<div class="showdown__resultado showdown__resultado--fracaso" role="status">
        <strong>¡Alarma activada!</strong> El Golpe ${resuelto.numero} fracasó.
      </div>`;

  contenedor.innerHTML = `
    <section class="bloque showdown showdown--resuelto">
      <h3>Golpe ${resuelto.numero} · resultado del showdown</h3>
      ${bannerExito}
      <p class="showdown__ayuda">
        Manos reveladas en orden ascendente de Ficha roja. El resultado permanece
        visible hasta que alguien mueva fichas en el siguiente golpe.
      </p>
      <ol class="showdown__lista">${filas}</ol>
    </section>`;
}

/** Renderiza la fila de un Jugador en el revelado del Showdown. */
function filaShowdownHtml(
  posicion: PosicionShowdown,
  golpe: VistaGolpe,
): string {
  const { jugador, estrellasRojas } = posicion;

  // Cartas de Bolsillo reveladas (en el Showdown la vista del servidor las revela
  // para todos). Se contemplan los casos límite por completitud.
  let cartas: string;
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    cartas = '<p class="mesa__sin-cartas">Sin Cartas de Bolsillo.</p>';
  } else {
    cartas = `<div class="cartas-fila cartas-fila--mini">${jugador.bolsillo
      .map(cartaHtml)
      .join('')}</div>`;
  }

  return `
    <li class="showdown__jugador">
      <div class="showdown__cabecera">
        <span class="showdown__nombre">${estatusJugadorHtml(jugador.conectado)}<span class="showdown__alias">${nombreConTooltipHtml(jugador.nombre, jugador.descripcion)}</span></span>
        <span class="ficha ficha--rojo" title="Ficha roja de ${estrellasRojas} estrellas">
          ${estrellas(estrellasRojas)}
        </span>
      </div>
      ${cartas}
      <p class="showdown__categoria">${categoriaManoHtml(jugador, golpe)}</p>
    </li>`;
}

/**
 * Evalúa la mejor mano del Jugador (sus 2 Cartas de Bolsillo + las 5
 * Comunitarias) con el Evaluador_Manos del dominio y devuelve el nombre de la
 * categoría en español. Si faltan cartas, lo indica sin romper la vista.
 */
function categoriaManoHtml(jugador: JugadorVisible, golpe: VistaGolpe): string {
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    return 'Mano no disponible.';
  }
  const resultado = evaluar(jugador.bolsillo, golpe.comunitarias);
  if (!resultado.ok) {
    return 'Faltan Cartas Comunitarias para evaluar la mano.';
  }
  const mano: ManoEvaluada = resultado.mano;
  return `Mejor mano: <strong>${NOMBRE_CATEGORIA[mano.categoria]}</strong>`;
}

// ===========================================================================
// Render del RESULTADO FINAL (fase FINALIZADA)
// ===========================================================================

/** Acciones opcionales en la pantalla de resultado final. */
export interface AccionesResultado {
  terminarPartida(): void;
}

/**
 * Renderiza la pantalla de resultado final temática (criterio 9.3): VICTORIA o
 * DERROTA del equipo, con el marcador de Bóvedas doradas y Alarmas rojas.
 */
export function renderizarResultado(
  contenedor: HTMLElement,
  vista: VistaPartida,
  acciones?: AccionesResultado,
): void {
  const esVictoria = vista.resultado === 'VICTORIA';
  const esDerrota = vista.resultado === 'DERROTA';

  let titulo: string;
  let mensaje: string;
  let claseEstado: string;

  if (esVictoria) {
    titulo = '¡Golpe maestro!';
    mensaje = 'El equipo abrió las tres bóvedas.';
    claseEstado = 'resultado--victoria';
  } else if (esDerrota) {
    titulo = 'El golpe ha fracasado';
    mensaje = 'Las alarmas os delataron…';
    claseEstado = 'resultado--derrota';
  } else {
    // Estado defensivo: FINALIZADA sin resultado explícito.
    titulo = 'El golpe ha terminado';
    mensaje = 'La banda se dispersa en la noche.';
    claseEstado = '';
  }

  const yoId = vista.perspectivaJugadorId;
  const botonTerminar =
    acciones !== undefined &&
    !vista.esEspectador &&
    vista.anfitrionId === yoId
      ? `<div class="resultado__acciones">
          <button type="button" id="boton-terminar-partida" class="boton boton--alias">
            Terminar partida
          </button>
        </div>`
      : '';

  contenedor.innerHTML = `
    <section class="resultado ${claseEstado}">
      <h2 class="resultado__titulo">${titulo}</h2>
      <p class="resultado__mensaje">${mensaje}</p>
      <div class="resultado__marcador">
        <div class="resultado__contador">
          <span class="resultado__etiqueta">Bóvedas doradas</span>
          <span class="resultado__valor resultado__valor--oro">${vista.bovedasDoradas} / 3</span>
        </div>
        <div class="resultado__contador">
          <span class="resultado__etiqueta">Alarmas rojas</span>
          <span class="resultado__valor resultado__valor--alarma">${vista.alarmasRojas} / 3</span>
        </div>
      </div>
      ${botonTerminar}
    </section>`;

  contenedor
    .querySelector<HTMLButtonElement>('#boton-terminar-partida')
    ?.addEventListener('click', () => acciones?.terminarPartida());
}
