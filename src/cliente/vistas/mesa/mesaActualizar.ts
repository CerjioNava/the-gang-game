import type { EstadoCliente } from '../../estado';
import type { VistaPartida } from '../../protocolo';
import type { VistaGolpe } from '../../../dominio/proyeccion';
import { BOLSILLO_OCULTO } from '../../../dominio/proyeccion';
import type { AccionesMesa } from './tipos';
import type { EstadoFichas } from '../../../dominio/modelos';
import {
  animarEntradaMesa,
  animarEntradaShowdownMesa,
  animarMovimientosFichas,
  animarNovedades,
  animarPulso,
  animarVolteoShowdown,
  elementoFichaEnUbicacion,
} from './mesaAnimaciones';
import { detectarMovimientosFichas } from './mesaFichasDiff';
import {
  htmlAccionesMesa,
  htmlAsientos,
  htmlHudMarcador,
  htmlHudRonda,
  htmlMesaPoker,
  htmlPoolCentro,
  htmlSeccionComunitarias,
  htmlTemporizadorHud,
  type MesaPokerContexto,
} from './mesaPokerHtml';
import { actualizarToastResultado, limpiarToastMesa } from './mesaToast';
import { htmlShowdownOrdenMesa, showdownMesaCompleto } from '../showdown';
import { enlazarEventosMesa, recordatorioEsperaHtml } from './mesaEventos';

interface MesaSnapshot {
  estructura: string;
  comunitarias: number;
  bovedas: number;
  alarmas: number;
  pool: string;
  asientos: string;
  fichas: EstadoFichas;
  overlay: string;
  reveladoShowdown: number;
  clavesCartas: Set<string>;
  clavesFichas: Set<string>;
}

const snapshots = new WeakMap<HTMLElement, MesaSnapshot>();

function construirContexto(estado: EstadoCliente): MesaPokerContexto | null {
  const vista = estado.vista;
  if (vista === null || vista.golpeActual === null) {
    return null;
  }
  const golpe = vista.golpeActual;
  const esEspectador = vista.esEspectador;
  const colorActivo = golpe.fichas.colorActivo;
  const misFichas = golpe.fichas.porJugador[vista.perspectivaJugadorId] ?? [];
  const tengoFichaActiva =
    !esEspectador && misFichas.some((f) => f.color === colorActivo);
  return {
    vista,
    golpe,
    esEspectador,
    tengoFichaActiva,
    esShowdown: golpe.ronda === 'SHOWDOWN',
  };
}

function claveEstructura(vista: VistaPartida, golpe: VistaGolpe): string {
  return [
    vista.jugadores.length,
    golpe.numero,
    golpe.ronda,
    vista.esEspectador,
    vista.perspectivaJugadorId,
  ].join('|');
}

function clavePool(golpe: VistaGolpe): string {
  return `${golpe.fichas.colorActivo}:${JSON.stringify(golpe.fichas.centro)}`;
}

function claveAsientos(vista: VistaPartida, golpe: VistaGolpe): string {
  const conexion = vista.jugadores.map((j) => `${j.id}:${j.conectado}`).join(',');
  const bolsillos = vista.jugadores
    .map((j) => `${j.id}:${j.bolsillo === BOLSILLO_OCULTO ? 'O' : 'V'}`)
    .join(',');
  return `${JSON.stringify(golpe.fichas.porJugador)}|${golpe.confirmados.join(',')}|${conexion}|${golpe.ronda}|${golpe.reveladoShowdown}|${bolsillos}`;
}

function claveOverlay(esShowdown: boolean): string {
  return esShowdown ? 'showdown' : '';
}

function montajeCompleto(
  contenedor: HTMLElement,
  ctx: MesaPokerContexto,
  acciones: AccionesMesa,
): MesaSnapshot {
  contenedor.innerHTML = htmlMesaPoker(ctx);
  const mesa = contenedor.querySelector<HTMLElement>('.mesa-poker');
  if (mesa !== null) {
    animarEntradaMesa(mesa);
  }
  return aplicarParches(contenedor, ctx, acciones, null);
}

function actualizarOverlay(contenedor: HTMLElement): void {
  const overlay = contenedor.querySelector<HTMLElement>('#mesa-poker-overlay');
  if (overlay !== null) {
    overlay.innerHTML = '';
  }
}

function actualizarAcciones(
  contenedor: HTMLElement,
  ctx: MesaPokerContexto,
): void {
  const slot = contenedor.querySelector('#mesa-poker-acciones');
  if (slot === null) {
    return;
  }
  slot.innerHTML = htmlAccionesMesa(ctx.esShowdown, ctx.vista, ctx.esEspectador);
}

function aplicarParches(
  contenedor: HTMLElement,
  ctx: MesaPokerContexto,
  acciones: AccionesMesa,
  prev: MesaSnapshot | null,
): MesaSnapshot {
  const { vista, golpe } = ctx;
  const mesa = contenedor.querySelector<HTMLElement>('.mesa-poker');
  if (mesa === null) {
    return montajeCompleto(contenedor, ctx, acciones);
  }

  const hud = mesa.querySelector('.mesa-poker__hud');
  if (hud !== null) {
    const marcador = hud.querySelector('.mesa-poker__marcador');
    if (marcador !== null) {
      marcador.outerHTML = htmlHudMarcador(vista);
    }
    const ronda = hud.querySelector('.mesa-poker__ronda');
    if (ronda !== null) {
      ronda.outerHTML = htmlHudRonda(vista, golpe);
    }
    const timerPrevio = hud.querySelector('.mesa-poker__timer');
    const timerHtml = htmlTemporizadorHud(golpe);
    if (timerHtml === '') {
      timerPrevio?.remove();
    } else if (timerPrevio !== null) {
      timerPrevio.outerHTML = timerHtml;
    } else {
      hud.insertAdjacentHTML('beforeend', timerHtml);
    }
  }

  actualizarToastResultado(mesa, vista);

  let movimientosFichas: ReturnType<typeof detectarMovimientosFichas> = [];
  const rectsOrigen = new Map<string, DOMRect>();
  if (prev !== null && prev.fichas !== undefined) {
    movimientosFichas = detectarMovimientosFichas(prev.fichas, golpe.fichas);
    for (const mov of movimientosFichas) {
      const origEl = elementoFichaEnUbicacion(mesa, mov.origen, mov.ficha);
      if (origEl !== null) {
        rectsOrigen.set(`f-${mov.ficha.color}-${mov.ficha.estrellas}`, origEl.getBoundingClientRect());
      }
    }
  }

  const centro = mesa.querySelector('.mesa-poker__centro');
  if (centro !== null) {
    const comunitariasPrev = centro.querySelector('.mesa-poker__centro-comunitarias');
    const comHtml = htmlSeccionComunitarias(golpe);
    if (comunitariasPrev !== null) {
      comunitariasPrev.outerHTML = comHtml;
    } else {
      centro.insertAdjacentHTML('afterbegin', comHtml);
    }

    const poolPrev = centro.querySelector('.mesa-poker__pool-centro');
    const showdownPrev = centro.querySelector('.showdown-mesa');
    const showdownHtml = htmlShowdownOrdenMesa(vista, golpe);

    if (showdownHtml === '') {
      showdownPrev?.remove();
      const poolHtml = htmlPoolCentro(ctx);
      if (poolHtml === '') {
        poolPrev?.remove();
      } else if (poolPrev !== null) {
        poolPrev.outerHTML = poolHtml;
      } else {
        centro.insertAdjacentHTML('beforeend', poolHtml);
      }
    } else {
      poolPrev?.remove();
      if (showdownPrev !== null) {
        showdownPrev.outerHTML = showdownHtml;
      } else {
        const comunitariasEl = centro.querySelector('.mesa-poker__centro-comunitarias');
        if (comunitariasEl !== null) {
          comunitariasEl.insertAdjacentHTML('afterend', showdownHtml);
        } else {
          centro.insertAdjacentHTML('beforeend', showdownHtml);
        }
      }
    }
  }

  const asientosEl = mesa.querySelector('.mesa-poker__asientos');
  if (asientosEl !== null) {
    asientosEl.innerHTML = htmlAsientos(ctx);
  }

  const showdownResuelto = ctx.esShowdown && showdownMesaCompleto(vista, golpe);
  mesa.classList.toggle('mesa-poker--showdown-resuelto', showdownResuelto);

  actualizarOverlay(contenedor);
  actualizarAcciones(contenedor, ctx);

  if (prev !== null && ctx.esShowdown && ctx.golpe.reveladoShowdown > prev.reveladoShowdown) {
    const orden = ctx.golpe.ordenShowdown;
    const jugadorId = orden[ctx.golpe.reveladoShowdown - 1];
    if (jugadorId !== undefined) {
      animarVolteoShowdown(mesa, jugadorId);
    }
  }

  const showdownCompleto = showdownMesaCompleto(vista, golpe);
  if (
    prev !== null &&
    showdownCompleto &&
    prev.reveladoShowdown < vista.jugadores.length
  ) {
    const showdownMesa = mesa.querySelector('.showdown-mesa');
    if (showdownMesa !== null) {
      animarEntradaShowdownMesa(showdownMesa);
    }
  }

  if (prev !== null) {
    if (prev.bovedas !== vista.bovedasDoradas || prev.alarmas !== vista.alarmasRojas) {
      const marcador = mesa.querySelector('.mesa-poker__marcador');
      if (marcador !== null) {
        animarPulso(marcador);
      }
    }
    const toast = mesa.querySelector('.mesa-poker__toast');
    if (toast !== null && (prev.bovedas !== vista.bovedasDoradas || prev.alarmas !== vista.alarmasRojas)) {
      animarPulso(toast);
    }
  }

  const clavesCartas = animarNovedades(
    mesa,
    '.mesa-poker__comunitarias [data-animate-key]',
    prev?.clavesCartas ?? new Set(),
  );
  let clavesFichas: Set<string>;
  if (movimientosFichas.length > 0) {
    clavesFichas = new Set<string>();
    mesa.querySelectorAll<HTMLElement>('.mesa-poker__pool [data-animate-key]').forEach((nodo) => {
      const clave = nodo.dataset['animateKey'];
      if (clave !== undefined && clave.length > 0) {
        clavesFichas.add(clave);
      }
    });
  } else {
    clavesFichas = animarNovedades(
      mesa,
      '.mesa-poker__pool [data-animate-key]',
      prev?.clavesFichas ?? new Set(),
    );
  }

  if (movimientosFichas.length > 0) {
    void animarMovimientosFichas(mesa, movimientosFichas, rectsOrigen);
  }

  if (!ctx.esEspectador) {
    enlazarEventosMesa(contenedor, acciones);
  }

  const snapshot: MesaSnapshot = {
    estructura: claveEstructura(vista, golpe),
    comunitarias: golpe.comunitarias.length,
    bovedas: vista.bovedasDoradas,
    alarmas: vista.alarmasRojas,
    pool: clavePool(golpe),
    asientos: claveAsientos(vista, golpe),
    fichas: golpe.fichas,
    overlay: claveOverlay(ctx.esShowdown),
    reveladoShowdown: golpe.reveladoShowdown,
    clavesCartas,
    clavesFichas,
  };
  snapshots.set(contenedor, snapshot);
  return snapshot;
}

/**
 * Actualiza la mesa con montaje completo o parches incrementales según el cambio
 * de estado. Preserva el DOM cuando la estructura del Golpe no cambia.
 */
export function actualizarMesa(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesMesa,
): void {
  const ctx = construirContexto(estado);
  if (ctx === null) {
    const mesaPrev = contenedor.querySelector<HTMLElement>('.mesa-poker');
    if (mesaPrev !== null) {
      limpiarToastMesa(mesaPrev);
    }
    contenedor.innerHTML = recordatorioEsperaHtml();
    snapshots.delete(contenedor);
    return;
  }

  const prev = snapshots.get(contenedor) ?? null;
  const estructura = claveEstructura(ctx.vista, ctx.golpe);
  const mesaExistente = contenedor.querySelector('.mesa-poker');

  if (mesaExistente === null || prev === null || prev.estructura !== estructura) {
    montajeCompleto(contenedor, ctx, acciones);
    return;
  }

  aplicarParches(contenedor, ctx, acciones, prev);
}
