// Utilidades de presentación del Showdown en la mesa (revelado progresivo en asientos).
//
// _Requirements: 8.2, 9.3_

import {
  comparar,
  compararSinKickers,
  evaluar,
  resolverShowdown as evaluarShowdownDominio,
  type ManoEvaluada,
} from "../../dominio";
import type { Carta, EstadoGolpe, Jugador } from "../../dominio/modelos";
import { BOLSILLO_OCULTO, type VistaGolpe } from "../../dominio/proyeccion";
import type { JugadorVisible, VistaPartida } from "../protocolo";
import { cartaHtml } from "./cartasHtml";
import { fichaInsigniaHtml, fichaOrdenShowdownHtml } from "./atoms/fichaHtml";
import { estatusJugadorHtml } from "./estatusJugador";
import { NOMBRE_CATEGORIA } from "./ranking";
import { nombreConTooltipHtml } from "./tooltipNombre";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface PosicionShowdown {
  jugador: JugadorVisible;
  estrellasRojas: number;
}

function ordenarPorFichaRoja(
  vista: VistaPartida,
  golpe: VistaGolpe,
): PosicionShowdown[] {
  const posiciones: PosicionShowdown[] = vista.jugadores.map((jugador) => {
    const susFichas = golpe.fichas.porJugador[jugador.id] ?? [];
    const fichaRoja = susFichas.find((f) => f.color === "ROJO");
    return {
      jugador,
      estrellasRojas: fichaRoja?.estrellas ?? 0,
    };
  });
  posiciones.sort((a, b) => a.estrellasRojas - b.estrellasRojas);
  return posiciones;
}

function categoriaManoTexto(
  jugador: JugadorVisible,
  golpe: VistaGolpe,
): string {
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    return "Mano no disponible.";
  }
  const resultado = evaluar(jugador.bolsillo, golpe.comunitarias);
  if (!resultado.ok) {
    return "Faltan Cartas Comunitarias.";
  }
  return NOMBRE_CATEGORIA[resultado.mano.categoria];
}

interface PosicionFuerza {
  jugador: JugadorVisible;
  mano: ManoEvaluada;
  bolsillo: [Carta, Carta];
  rangoVerde: number;
}

/** Indica si todas las manos del showdown ya fueron reveladas. */
export function showdownMesaCompleto(
  vista: VistaPartida,
  golpe: VistaGolpe,
): boolean {
  return (
    golpe.ronda === "SHOWDOWN" &&
    golpe.reveladoShowdown >= vista.jugadores.length
  );
}

/** Orden ascendente por fuerza de mano (rango verde 1 = más débil). */
export function ordenarPorFuerzaMano(
  vista: VistaPartida,
  golpe: VistaGolpe,
): PosicionFuerza[] | null {
  const usarSinKickers = vista.ajustes?.sinKickers === true;
  const evaluados: Array<{
    jugador: JugadorVisible;
    mano: ManoEvaluada;
    bolsillo: [Carta, Carta];
  }> = [];

  for (const jugador of vista.jugadores) {
    if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
      return null;
    }
    const resultado = evaluar(jugador.bolsillo, golpe.comunitarias);
    if (!resultado.ok) {
      return null;
    }
    evaluados.push({
      jugador,
      mano: resultado.mano,
      bolsillo: jugador.bolsillo,
    });
  }

  evaluados.sort((a, b) => {
    if (usarSinKickers) {
      return compararSinKickers(a.mano, b.mano, a.bolsillo, b.bolsillo);
    }
    return comparar(a.mano, b.mano);
  });

  return evaluados.map((entrada, indice) => ({
    ...entrada,
    rangoVerde: indice + 1,
  }));
}

function evaluarResultadoShowdown(vista: VistaPartida, golpe: VistaGolpe) {
  const jugadores: Jugador[] = vista.jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    ...(j.descripcion !== undefined ? { descripcion: j.descripcion } : {}),
    bolsillo:
      j.bolsillo === null || j.bolsillo === BOLSILLO_OCULTO ? null : j.bolsillo,
  }));
  if (
    jugadores.some((j) => j.bolsillo === null) ||
    golpe.comunitarias.length < 5
  ) {
    return null;
  }
  const estadoGolpe: EstadoGolpe = {
    numero: golpe.numero,
    ronda: "SHOWDOWN",
    baraja: [],
    comunitarias: [...golpe.comunitarias],
    fichas: golpe.fichas,
    confirmados: [...golpe.confirmados],
    reveladoShowdown: golpe.reveladoShowdown,
  };
  return evaluarShowdownDominio(jugadores, estadoGolpe, vista.ajustes);
}

function celdaOrdenMesaHtml(
  posicion: PosicionShowdown,
  golpe: VistaGolpe,
  indiceRojo: number,
  rangoVerde: number,
  esViolacion: boolean,
  tipo: "rojo" | "verde",
  estrellas: number,
): string {
  const categoria = categoriaManoTexto(posicion.jugador, golpe);
  const desajuste = tipo === "rojo" && rangoVerde !== indiceRojo + 1;
  const clases = [
    "showdown-mesa__celda",
    desajuste ? "showdown-mesa__celda--desajuste" : "",
    esViolacion ? "showdown-mesa__celda--violacion" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <li class="${clases}">
      ${fichaOrdenShowdownHtml(estrellas, tipo)}
      <span class="showdown-mesa__nombre">${escapar(posicion.jugador.nombre)}</span>
      <span class="showdown-mesa__categoria">${escapar(categoria)}</span>
    </li>`;
}

/** Bloque central en la mesa: orden revelado vs orden correcto + banner dramático. */
export function htmlShowdownOrdenMesa(
  vista: VistaPartida,
  golpe: VistaGolpe,
): string {
  if (!showdownMesaCompleto(vista, golpe)) {
    return "";
  }

  const evaluacion = evaluarResultadoShowdown(vista, golpe);
  const ordenFuerza = ordenarPorFuerzaMano(vista, golpe);
  if (evaluacion === null || ordenFuerza === null) {
    return "";
  }

  const ordenRojo = ordenarPorFichaRoja(vista, golpe);
  const rangoVerdePorId = new Map(
    ordenFuerza.map((p) => [p.jugador.id, p.rangoVerde]),
  );
  const posicionRojaPorId = new Map(ordenRojo.map((p, i) => [p.jugador.id, i]));

  let violacionIdx = -1;
  if (evaluacion.violacion !== null) {
    violacionIdx = ordenRojo.findIndex(
      (p) => p.jugador.id === evaluacion.violacion!.posterior,
    );
  }

  const filasRojas = ordenRojo
    .map((posicion, indice) => {
      const rangoVerde = rangoVerdePorId.get(posicion.jugador.id) ?? indice + 1;
      const esViolacion = indice === violacionIdx;
      const estrellas =
        posicion.estrellasRojas > 0 ? posicion.estrellasRojas : indice + 1;
      return celdaOrdenMesaHtml(
        posicion,
        golpe,
        indice,
        rangoVerde,
        esViolacion,
        "rojo",
        estrellas,
      );
    })
    .join("");

  const filasVerdes = ordenFuerza
    .map((posicion) => {
      const posicionRoja: PosicionShowdown = {
        jugador: posicion.jugador,
        estrellasRojas:
          ordenRojo.find((p) => p.jugador.id === posicion.jugador.id)
            ?.estrellasRojas ?? posicion.rangoVerde,
      };
      const indiceRojo =
        posicionRojaPorId.get(posicion.jugador.id) ?? posicion.rangoVerde - 1;
      return celdaOrdenMesaHtml(
        posicionRoja,
        golpe,
        indiceRojo,
        posicion.rangoVerde,
        false,
        "verde",
        posicion.rangoVerde,
      );
    })
    .join("");

  const ayuda = evaluacion.exito
    ? "Orden correcto: la fuerza no decrece al revelar."
    : "Orden incorrecto: una mano posterior es más débil que la anterior.";

  const banner = evaluacion.exito
    ? `<div class="showdown-mesa__banner showdown-mesa__banner--exito" role="status">
        <strong>¡Bóveda abierta!</strong>
        <span>Golpe ${golpe.numero} · éxito para la banda</span>
      </div>`
    : `<div class="showdown-mesa__banner showdown-mesa__banner--fracaso" role="status">
        <strong>¡Alarma activada!</strong>
        <span>Golpe ${golpe.numero} · el golpe fracasó</span>
      </div>`;

  return `
    <div class="showdown-mesa" role="region" aria-label="Resultado del Showdown">
      ${banner}
      <div class="showdown-mesa__filas">
        <section class="showdown-mesa__fila" aria-label="Orden revelado">
          <p class="showdown-mesa__etiq">Orden revelado (ficha roja)</p>
          <ol class="showdown-mesa__lista">${filasRojas}</ol>
        </section>
        <section class="showdown-mesa__fila" aria-label="Orden correcto por fuerza">
          <p class="showdown-mesa__etiq">Orden correcto (ficha verde)</p>
          <ol class="showdown-mesa__lista">${filasVerdes}</ol>
        </section>
      </div>
      <p class="showdown-mesa__ayuda">${ayuda}</p>
    </div>`;
}

/** Resumen del orden de revelado en la barra inferior (sin banner de resultado). */
export function htmlResumenOrdenShowdown(
  vista: VistaPartida,
  golpe: VistaGolpe,
): string {
  const evaluacion = evaluarResultadoShowdown(vista, golpe);
  if (evaluacion === null) {
    return "";
  }

  const orden = ordenarPorFichaRoja(vista, golpe);
  let violacionIdx = -1;
  if (evaluacion.violacion !== null) {
    violacionIdx = orden.findIndex(
      (p) => p.jugador.id === evaluacion.violacion!.posterior,
    );
  }

  const filas = orden
    .map((posicion, indice) => {
      const categoria = categoriaManoTexto(posicion.jugador, golpe);
      const fichaHtml =
        posicion.estrellasRojas > 0
          ? fichaInsigniaHtml({
              color: "ROJO",
              estrellas: posicion.estrellasRojas,
            })
          : "";
      let marca = "✓";
      let claseMarca = "showdown-resumen__marca showdown-resumen__marca--ok";
      if (indice === 0) {
        marca = "·";
        claseMarca = "showdown-resumen__marca";
      } else if (indice === violacionIdx) {
        marca = "✗";
        claseMarca = "showdown-resumen__marca showdown-resumen__marca--error";
      } else if (violacionIdx >= 0 && indice > violacionIdx) {
        marca = "—";
        claseMarca = "showdown-resumen__marca";
      }
      return `
        <li class="showdown-resumen__fila">
          <span class="${claseMarca}" aria-hidden="true">${marca}</span>
          <span class="showdown-resumen__nombre">${escapar(posicion.jugador.nombre)}</span>
          ${fichaHtml}
          <span class="showdown-resumen__categoria">${escapar(categoria)}</span>
        </li>`;
    })
    .join("");

  const ayuda = evaluacion.exito
    ? "Orden correcto: la fuerza no decrece al revelar."
    : "Orden incorrecto: una mano posterior es más débil que la anterior.";

  return `
    <div class="showdown-resumen" role="region" aria-label="Orden de revelado del Showdown">
      <p class="showdown-resumen__titulo">Orden de revelado (ficha roja 1→${orden.length})</p>
      <ol class="showdown-resumen__lista">${filas}</ol>
      <p class="showdown-resumen__ayuda">${ayuda}</p>
    </div>`;
}

/** Botones y resumen del Showdown en la barra inferior de la mesa. */
export function htmlAccionesShowdown(
  vista: VistaPartida,
  esEspectador: boolean,
): string {
  const golpe = vista.golpeActual;
  if (golpe === null || golpe.ronda !== "SHOWDOWN") {
    return "";
  }

  const total = vista.jugadores.length;
  const revelado = golpe.reveladoShowdown;

  if (esEspectador) {
    if (revelado < total) {
      return `<p class="showdown__espera-resolver">Revelado de manos: ${revelado}/${total}</p>`;
    }
    return `<p class="showdown__espera-resolver">Esperando a que un jugador cierre el showdown…</p>`;
  }

  let boton = "";
  if (revelado < total) {
    const siguienteId = golpe.ordenShowdown[revelado];
    const siguiente = vista.jugadores.find((j) => j.id === siguienteId);
    const nombre = siguiente?.nombre ?? "siguiente";
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

  return `
    <div class="showdown-acciones">
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
export function htmlCategoriaAsientoShowdown(
  jugador: JugadorVisible,
  golpe: VistaGolpe,
): string {
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    return "";
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
    contenedor.innerHTML = "";
    return;
  }

  const golpeVista: VistaGolpe = {
    numero: resuelto.numero,
    ronda: "SHOWDOWN",
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
    .join("");

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

function filaShowdownHtml(
  posicion: PosicionShowdown,
  golpe: VistaGolpe,
): string {
  const { jugador, estrellasRojas } = posicion;

  let cartas: string;
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    cartas = '<p class="mesa__sin-cartas">Sin Cartas de Bolsillo.</p>';
  } else {
    cartas = `<div class="cartas-fila cartas-fila--mini">${jugador.bolsillo
      .map((c) => cartaHtml(c, "mini"))
      .join("")}</div>`;
  }

  const fichaRojaHtml =
    estrellasRojas > 0
      ? fichaInsigniaHtml({ color: "ROJO", estrellas: estrellasRojas })
      : "";

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
    return "Mano no disponible.";
  }
  const resultado = evaluar(jugador.bolsillo, golpe.comunitarias);
  if (!resultado.ok) {
    return "Faltan Cartas Comunitarias para evaluar la mano.";
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
  const esVictoria = vista.resultado === "VICTORIA";
  const esDerrota = vista.resultado === "DERROTA";

  let titulo: string;
  let mensaje: string;
  let claseEstado: string;

  if (esVictoria) {
    titulo = "¡Golpe maestro!";
    mensaje = "El equipo abrió las tres bóvedas.";
    claseEstado = "resultado--victoria";
  } else if (esDerrota) {
    titulo = "El golpe ha fracasado";
    mensaje = "Las alarmas os delataron…";
    claseEstado = "resultado--derrota";
  } else {
    titulo = "El golpe ha terminado";
    mensaje = "La banda se dispersa en la noche.";
    claseEstado = "";
  }

  const botonTerminar =
    acciones !== undefined && !vista.esEspectador
      ? `<button type="button" id="boton-terminar-partida" class="boton boton--alias">
            Terminar partida
          </button>`
      : "";

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
      <div class="resultado__acciones">
        <div class="resultado__chat-slot" id="pantalla-fin-chat"></div>
        ${botonTerminar}
      </div>
    </section>`;

  contenedor
    .querySelector<HTMLButtonElement>("#boton-terminar-partida")
    ?.addEventListener("click", () => acciones?.terminarPartida());
}
