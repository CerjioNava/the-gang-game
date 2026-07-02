import { evaluar, type Carta } from "../../../dominio";
import {
  BOLSILLO_OCULTO,
  type VistaGolpe,
  type VistaShowdownResuelto,
} from "../../../dominio/proyeccion";
import type { JugadorVisible, VistaPartida } from "../../protocolo";
import { cartasFilaHtml } from "../cartasHtml";
import { fichaInsigniaHtml } from "../atoms/fichaHtml";
import { NOMBRE_CATEGORIA } from "../ranking";
import { htmlShowdownOrdenMesa } from "../showdown";
import { nombreConTooltipHtml } from "../tooltipNombre";

const ID_BOTON = "mesa-historial-boton";
const ID_OVERLAY = "mesa-historial-overlay";
const CLASE_OVERLAY_VISIBLE = "historial-overlay--visible";
const DURACION_CIERRE_MS = 300;

let numeroSeleccionado: number | null = null;
let escapeRegistrado = false;
let cerrandoHistorial = false;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function snapshotActual(vista: VistaPartida): VistaShowdownResuelto | null {
  if (vista.historialShowdowns.length === 0) {
    return null;
  }
  const existeSeleccion =
    numeroSeleccionado !== null &&
    vista.historialShowdowns.some(
      (showdown) => showdown.numero === numeroSeleccionado,
    );
  const numero = existeSeleccion
    ? numeroSeleccionado
    : vista.historialShowdowns[vista.historialShowdowns.length - 1]!.numero;
  numeroSeleccionado = numero;
  return (
    vista.historialShowdowns.find((showdown) => showdown.numero === numero) ??
    null
  );
}

export function htmlBotonHistorial(vista: VistaPartida): string {
  const total = vista.historialShowdowns.length;
  if (total === 0) {
    return "";
  }
  return `
    <button
      type="button"
      id="${ID_BOTON}"
      class="boton boton--alias mesa-poker__historial-boton"
      aria-haspopup="dialog"
      aria-controls="${ID_OVERLAY}"
    >
      Historial de golpes <span class="mesa-poker__historial-count">${total}</span>
    </button>`;
}

function golpeDesdeSnapshot(showdown: VistaShowdownResuelto): VistaGolpe {
  return {
    numero: showdown.numero,
    ronda: "SHOWDOWN",
    comunitarias: showdown.comunitarias,
    fichas: showdown.fichas,
    confirmados: [],
    reveladoShowdown: showdown.jugadores.length,
    ordenShowdown: showdown.jugadores.map((jugador) => jugador.id),
  };
}

function vistaDesdeSnapshot(
  vista: VistaPartida,
  showdown: VistaShowdownResuelto,
  golpe: VistaGolpe,
): VistaPartida {
  return {
    ...vista,
    jugadores: showdown.jugadores,
    golpeActual: golpe,
  };
}

function categoriaJugador(
  jugador: JugadorVisible,
  comunitarias: readonly Carta[],
): string {
  if (jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO) {
    return "Mano no disponible";
  }
  const resultado = evaluar(jugador.bolsillo, comunitarias);
  return resultado.ok
    ? NOMBRE_CATEGORIA[resultado.mano.categoria]
    : "Mano incompleta";
}

function fichaRojaJugador(jugador: JugadorVisible, golpe: VistaGolpe): string {
  const ficha = (golpe.fichas.porJugador[jugador.id] ?? []).find(
    (f) => f.color === "ROJO",
  );
  return ficha === undefined ? "" : fichaInsigniaHtml(ficha);
}

function manosReveladasHtml(
  showdown: VistaShowdownResuelto,
  golpe: VistaGolpe,
): string {
  const filas = showdown.jugadores
    .map((jugador) => {
      const cartas =
        jugador.bolsillo === null || jugador.bolsillo === BOLSILLO_OCULTO
          ? '<p class="historial-golpe__sin-cartas">Sin cartas reveladas.</p>'
          : cartasFilaHtml(jugador.bolsillo, "mini");
      return `
        <article class="historial-golpe__jugador">
          <header class="historial-golpe__jugador-head">
            <span class="historial-golpe__nombre">${nombreConTooltipHtml(jugador.nombre, jugador.descripcion)}</span>
            ${fichaRojaJugador(jugador, golpe)}
          </header>
          ${cartas}
          <p class="historial-golpe__categoria">${escapar(categoriaJugador(jugador, showdown.comunitarias))}</p>
        </article>`;
    })
    .join("");

  return `
    <section class="historial-golpe__manos" aria-label="Manos reveladas">
      <h3>Manos de la banda</h3>
      <div class="historial-golpe__comunitarias">
        <span>Comunitarias</span>
        ${cartasFilaHtml(showdown.comunitarias, "mini")}
      </div>
      <div class="historial-golpe__jugadores">${filas}</div>
    </section>`;
}

function botonesGolpesHtml(vista: VistaPartida, seleccionado: number): string {
  return vista.historialShowdowns
    .map((showdown) => {
      const resumen = vista.historialGolpes.find(
        (entrada) => entrada.numero === showdown.numero,
      );
      const activo =
        showdown.numero === seleccionado ? " historial-golpe__tab--activo" : "";
      const tono = showdown.exito
        ? "historial-golpe__pill--exito"
        : "historial-golpe__pill--fracaso";
      const resultado = showdown.exito ? "Bóveda" : "Alarma";
      const marcador =
        resumen === undefined
          ? ""
          : `${resumen.bovedasTras} bóvedas · ${resumen.alarmasTras} alarmas`;
      return `
        <button type="button" class="historial-golpe__tab${activo}" data-golpe="${showdown.numero}">
          <span>Golpe ${showdown.numero}</span>
          <span class="historial-golpe__pill ${tono}">${resultado}</span>
          <small>${escapar(marcador)}</small>
        </button>`;
    })
    .join("");
}

function panelHtml(vista: VistaPartida): string {
  const seleccionado = snapshotActual(vista);
  if (seleccionado === null) {
    return "";
  }
  const golpe = golpeDesdeSnapshot(seleccionado);
  const vistaOrden = vistaDesdeSnapshot(vista, seleccionado, golpe);
  const resultado = seleccionado.exito
    ? "¡Bóveda abierta!"
    : "¡Alarma activada!";
  const detalle = seleccionado.exito
    ? "La banda respetó el orden de fuerza."
    : "El orden de revelado rompió la secuencia correcta.";

  return `
    <div class="historial-overlay__fondo" data-accion="CERRAR_HISTORIAL"></div>
    <aside class="historial-panel" role="dialog" aria-modal="true" aria-labelledby="historial-titulo">
      <header class="historial-panel__cabecera">
        <div>
          <p class="historial-panel__eyebrow">Historial de golpes</p>
          <h2 id="historial-titulo">Golpe ${seleccionado.numero}</h2>
        </div>
        <button type="button" class="historial-panel__cerrar" data-accion="CERRAR_HISTORIAL" aria-label="Cerrar historial">×</button>
      </header>
      <div class="historial-panel__contenido">
        <nav class="historial-golpe__tabs" aria-label="Golpes resueltos">
          ${botonesGolpesHtml(vista, seleccionado.numero)}
        </nav>
        <div class="historial-golpe__detalle">
          <section class="historial-golpe__resumen historial-golpe__resumen--${seleccionado.exito ? "exito" : "fracaso"}">
            <strong>${resultado}</strong>
            <span>${detalle}</span>
          </section>
          ${htmlShowdownOrdenMesa(vistaOrden, golpe)}
          ${manosReveladasHtml(seleccionado, golpe)}
        </div>
      </div>
    </aside>`;
}

function cerrarPanel(): void {
  const overlay = document.getElementById(ID_OVERLAY);
  const boton = document.getElementById(ID_BOTON);
  if (overlay === null || overlay.hidden || cerrandoHistorial) {
    return;
  }

  cerrandoHistorial = true;
  overlay.classList.remove(CLASE_OVERLAY_VISIBLE);
  boton?.setAttribute("aria-expanded", "false");

  const panel = overlay.querySelector(".historial-panel");
  const finalizar = (): void => {
    overlay.hidden = true;
    overlay.innerHTML = "";
    cerrandoHistorial = false;
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
    if (cerrandoHistorial) {
      panel.removeEventListener("transitionend", onFin);
      finalizar();
    }
  }, DURACION_CIERRE_MS);
}

function abrirPanel(vista: VistaPartida): void {
  const overlay = document.getElementById(ID_OVERLAY);
  const boton = document.getElementById(ID_BOTON);
  if (overlay === null || cerrandoHistorial) {
    return;
  }

  overlay.innerHTML = panelHtml(vista);
  overlay.hidden = false;
  overlay.classList.remove(CLASE_OVERLAY_VISIBLE);
  boton?.setAttribute("aria-expanded", "true");

  requestAnimationFrame(() => {
    overlay.classList.add(CLASE_OVERLAY_VISIBLE);
  });
}

function asegurarOverlay(): HTMLElement {
  let overlay = document.getElementById(ID_OVERLAY);
  if (overlay === null) {
    overlay = document.createElement("div");
    overlay.id = ID_OVERLAY;
    overlay.className = "historial-overlay";
    overlay.hidden = true;
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function montarPanelHistorial(vista: VistaPartida | null): void {
  const overlay = asegurarOverlay();
  const boton = document.getElementById(ID_BOTON) as HTMLButtonElement | null;

  if (vista === null || vista.historialShowdowns.length === 0) {
    cerrarPanel();
    return;
  }

  if (boton !== null) {
    boton.onclick = () => abrirPanel(vista);
  }

  overlay.onclick = (evento) => {
    const objetivo = evento.target as HTMLElement;
    if (objetivo.dataset["accion"] === "CERRAR_HISTORIAL") {
      cerrarPanel();
      return;
    }

    const tab = objetivo.closest<HTMLButtonElement>("[data-golpe]");
    if (tab !== null) {
      numeroSeleccionado = Number(tab.dataset["golpe"]);
      overlay.innerHTML = panelHtml(vista);
    }
  };

  if (!escapeRegistrado) {
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        const overlayActual = document.getElementById(ID_OVERLAY);
        if (overlayActual !== null && !overlayActual.hidden) {
          cerrarPanel();
        }
      }
    });
    escapeRegistrado = true;
  }

  if (!overlay.hidden && !cerrandoHistorial) {
    overlay.innerHTML = panelHtml(vista);
    overlay.classList.add(CLASE_OVERLAY_VISIBLE);
  }
}
