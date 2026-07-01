// Utilidades de presentación del Showdown en la mesa (revelado progresivo en asientos).
//
// _Requirements: 8.2, 9.3_

import {
  evaluar,
  resolverShowdown as evaluarShowdownDominio,
  type ManoEvaluada,
} from '../../dominio';
import type { EstadoGolpe, Jugador } from '../../dominio/modelos';
import { BOLSILLO_OCULTO, type VistaGolpe, type VistaShowdownResuelto } from '../../dominio/proyeccion';
import type { Carta, JugadorVisible, Palo, VistaPartida } from '../protocolo';
import { fichaInsigniaHtml } from './atoms/fichaHtml';
import { estatusJugadorHtml } from './estatusJugador';
import { NOMBRE_CATEGORIA } from './ranking';
import { nombreConTooltipHtml } from './tooltipNombre';

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SIMBOLO_PALO: Record<Palo, string> = {
  PICAS: '♠',
  CORAZONES: '♥',
  DIAMANTES: '♦',
  TREBOLES: '♣',
};

function paloEsRojo(palo: Palo): boolean {
  return palo === 'CORAZONES' || palo === 'DIAMANTES';
}

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

function cartaHtml(carta: Carta): string {
  const clase = paloEsRojo(carta.palo) ? 'carta carta--roja' : 'carta carta--negra';
  return `
    <div class="${clase}">
      <span class="carta__valor">${etiquetaValor(carta.valor)}</span>
      <span class="carta__palo">${SIMBOLO_PALO[carta.palo]}</span>
    </div>`;
}

interface PosicionShowdown {
  jugador: JugadorVisible;
  estrellasRojas: number;
}

function ordenarPorFichaRoja(vista: VistaPartida, golpe: VistaGolpe): PosicionShowdown[] {
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

function categoriaManoTexto(jugador: JugadorVisible, golpe: VistaGolpe): string {
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    return 'Mano no disponible.';
  }
  const resultado = evaluar(jugador.bolsillo, golpe.comunitarias);
  if (!resultado.ok) {
    return 'Faltan Cartas Comunitarias.';
  }
  return NOMBRE_CATEGORIA[resultado.mano.categoria];
}

function evaluarResultadoShowdown(vista: VistaPartida, golpe: VistaGolpe) {
  const jugadores: Jugador[] = vista.jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    descripcion: j.descripcion,
    bolsillo:
      j.bolsillo === null || j.bolsillo === BOLSILLO_OCULTO ? null : j.bolsillo,
  }));
  if (jugadores.some((j) => j.bolsillo === null) || golpe.comunitarias.length < 5) {
    return null;
  }
  const estadoGolpe: EstadoGolpe = {
    numero: golpe.numero,
    ronda: 'SHOWDOWN',
    baraja: [],
    comunitarias: [...golpe.comunitarias],
    fichas: golpe.fichas,
    confirmados: [...golpe.confirmados],
    reveladoShowdown: golpe.reveladoShowdown,
  };
  return evaluarShowdownDominio(jugadores, estadoGolpe, vista.ajustes);
}

/** Resumen del orden de revelado en la barra inferior (sin banner de resultado). */
export function htmlResumenOrdenShowdown(vista: VistaPartida, golpe: VistaGolpe): string {
  const evaluacion = evaluarResultadoShowdown(vista, golpe);
  if (evaluacion === null) {
    return '';
  }

  const orden = ordenarPorFichaRoja(vista, golpe);
  let violacionIdx = -1;
  if (evaluacion.violacion !== null) {
    violacionIdx = orden.findIndex((p) => p.jugador.id === evaluacion.violacion!.posterior);
  }

  const filas = orden
    .map((posicion, indice) => {
      const categoria = categoriaManoTexto(posicion.jugador, golpe);
      const fichaHtml =
        posicion.estrellasRojas > 0
          ? fichaInsigniaHtml({ color: 'ROJO', estrellas: posicion.estrellasRojas })
          : '';
      let marca = '✓';
      let claseMarca = 'showdown-resumen__marca showdown-resumen__marca--ok';
      if (indice === 0) {
        marca = '·';
        claseMarca = 'showdown-resumen__marca';
      } else if (indice === violacionIdx) {
        marca = '✗';
        claseMarca = 'showdown-resumen__marca showdown-resumen__marca--error';
      } else if (violacionIdx >= 0 && indice > violacionIdx) {
        marca = '—';
        claseMarca = 'showdown-resumen__marca';
      }
      return `
        <li class="showdown-resumen__fila">
          <span class="${claseMarca}" aria-hidden="true">${marca}</span>
          <span class="showdown-resumen__nombre">${escapar(posicion.jugador.nombre)}</span>
          ${fichaHtml}
          <span class="showdown-resumen__categoria">${escapar(categoria)}</span>
        </li>`;
    })
    .join('');

  const ayuda = evaluacion.exito
    ? 'Orden correcto: la fuerza no decrece al revelar.'
    : 'Orden incorrecto: una mano posterior es más débil que la anterior.';

  return `
    <div class="showdown-resumen" role="region" aria-label="Orden de revelado del Showdown">
      <p class="showdown-resumen__titulo">Orden de revelado (ficha roja 1→${orden.length})</p>
      <ol class="showdown-resumen__lista">${filas}</ol>
      <p class="showdown-resumen__ayuda">${ayuda}</p>
    </div>`;
}

/** Botones y resumen del Showdown en la barra inferior de la mesa. */
export function htmlAccionesShowdown(vista: VistaPartida, esEspectador: boolean): string {
  const golpe = vista.golpeActual;
  if (golpe === null || golpe.ronda !== 'SHOWDOWN') {
    return '';
  }

  const total = vista.jugadores.length;
  const revelado = golpe.reveladoShowdown;

  if (esEspectador) {
    if (revelado < total) {
      return `<p class="showdown__espera-resolver">Revelado de manos: ${revelado}/${total}</p>`;
    }
    return `<p class="showdown__espera-resolver">Esperando a que un jugador cierre el showdown…</p>`;
  }

  let boton = '';
  if (revelado < total) {
    const siguienteId = golpe.ordenShowdown[revelado];
    const siguiente = vista.jugadores.find((j) => j.id === siguienteId);
    const nombre = siguiente?.nombre ?? 'siguiente';
    boton = `
      <button type="button" id="boton-revelar-showdown" class="boton boton--golpe">
        Revelar mano de ${escapar(nombre)}
      </button>`;
  } else {
    boton = `
      <button type="button" id="boton-resolver" class="boton boton--golpe">
        Continuar al siguiente golpe
      </button>`;
  }

  const resumen = revelado >= total ? htmlResumenOrdenShowdown(vista, golpe) : '';

  return `
    <div class="showdown-acciones">
      ${resumen}
      <div class="showdown-acciones__botones">${boton}</div>
    </div>`;
}

/** @deprecated Usar htmlAccionesShowdown en la barra de la mesa. */
export function htmlBotonContinuarShowdown(esEspectador: boolean): string {
  if (esEspectador) {
    return `<p class="showdown__espera-resolver">Esperando a que un jugador cierre el showdown…</p>`;
  }
  return `
    <button type="button" id="boton-resolver" class="boton boton--golpe showdown__continuar">
      Continuar al siguiente golpe
    </button>`;
}

/** Categoría de mano para mostrar bajo las cartas de un asiento revelado. */
export function htmlCategoriaAsientoShowdown(jugador: JugadorVisible, golpe: VistaGolpe): string {
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    return '';
  }
  const texto = categoriaManoTexto(jugador, golpe);
  return `<p class="asiento__categoria-mano">${escapar(texto)}</p>`;
}

/**
 * Renderiza el Showdown ya resuelto (pantalla finalizada).
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
    reveladoShowdown: resuelto.jugadores.length,
    ordenShowdown: resuelto.jugadores.map((j) => j.id),
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
      <ol class="showdown__lista">${filas}</ol>
    </section>`;
}

function filaShowdownHtml(posicion: PosicionShowdown, golpe: VistaGolpe): string {
  const { jugador, estrellasRojas } = posicion;

  let cartas: string;
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    cartas = '<p class="mesa__sin-cartas">Sin Cartas de Bolsillo.</p>';
  } else {
    cartas = `<div class="cartas-fila cartas-fila--mini">${jugador.bolsillo
      .map(cartaHtml)
      .join('')}</div>`;
  }

  const fichaRojaHtml =
    estrellasRojas > 0
      ? fichaInsigniaHtml({ color: 'ROJO', estrellas: estrellasRojas })
      : '';

  return `
    <li class="showdown__jugador">
      <div class="showdown__cabecera">
        <span class="showdown__nombre">${estatusJugadorHtml(jugador.conectado)}<span class="showdown__alias">${nombreConTooltipHtml(jugador.nombre, jugador.descripcion)}</span></span>
        ${fichaRojaHtml}
      </div>
      ${cartas}
      <p class="showdown__categoria">${categoriaManoHtml(jugador, golpe)}</p>
    </li>`;
}

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

export interface AccionesResultado {
  terminarPartida(): void;
}

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
