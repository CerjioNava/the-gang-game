import type {
  ColorFicha,
  Ficha,
  JugadorVisible,
  VistaPartida,
} from "../../protocolo";
import { BOLSILLO_OCULTO, type VistaGolpe } from "../../../dominio/proyeccion";
import {
  cartasFilaHtml,
  cartasOcultasVolteoHtml,
  cartasVolteoHtml,
  dorsoCartaHtml,
  cartaHtml,
} from "../cartasHtml";
import {
  fichaBotonHtml,
  fichaInsigniaHtml,
  indicadorColorFichaHtml,
  ranurasFichasJugadorHtml,
} from "../atoms/fichaHtml";
import {
  htmlAccionesShowdown,
  htmlCategoriaAsientoShowdown,
  showdownMesaCompleto,
} from "../showdown";
import { urlMesa } from "../cartasSvg";
import { estatusJugadorHtml } from "../estatusJugador";
import { nombreConTooltipHtml } from "../tooltipNombre";
import { htmlBotonHistorial } from "./historialGolpes";
import {
  calcularPosicionesAsientos,
  contarRivales,
  type PosicionAsiento,
} from "./posicionesAsientos";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ETIQUETA_RONDA: Record<VistaGolpe["ronda"], string> = {
  PRE_FLOP: "Pre-Flop",
  FLOP: "Flop",
  TURN: "Turn",
  RIVER: "River",
  SHOWDOWN: "Showdown",
};

const COLOR_DE_RONDA: Record<VistaGolpe["ronda"], ColorFicha | null> = {
  PRE_FLOP: "BLANCO",
  FLOP: "AMARILLO",
  TURN: "NARANJA",
  RIVER: "ROJO",
  SHOWDOWN: null,
};

function pintarContador(activas: number, total: number, tipo: string): string {
  let html = "";
  for (let i = 0; i < total; i += 1) {
    const lleno = i < activas ? `marca--${tipo}-lleno` : `marca--${tipo}-vacio`;
    html += `<span class="marca ${lleno}"></span>`;
  }
  return html;
}

function marcadorCompactoHtml(vista: VistaPartida): string {
  return `
    <div class="mesa-poker__marcador" aria-label="Marcador del Golpe">
      <span class="mesa-poker__marcador-grupo" title="Bóvedas doradas">
        <span class="mesa-poker__marcador-etiq">Bóveda</span>
        ${pintarContador(vista.bovedasDoradas, 3, "boveda")}
        <span class="mesa-poker__marcador-num">${vista.bovedasDoradas}/3</span>
      </span>
      <span class="mesa-poker__marcador-grupo" title="Alarmas rojas">
        <span class="mesa-poker__marcador-etiq">Alarma</span>
        ${pintarContador(vista.alarmasRojas, 3, "alarma")}
        <span class="mesa-poker__marcador-num">${vista.alarmasRojas}/3</span>
      </span>
    </div>`;
}

function temporizadorHudHtml(golpe: VistaGolpe): string {
  const finAt = golpe.temporizadorFinAt;
  if (finAt == null || finAt <= Date.now()) {
    return "";
  }
  const segundos = Math.max(1, Math.ceil((finAt - Date.now()) / 1000));
  return `
    <div class="mesa-poker__timer" role="timer" aria-live="polite">
      <span class="mesa-poker__timer-valor">${segundos}s</span>
    </div>`;
}

function centroComunitariasHtml(golpe: VistaGolpe): string {
  const slots = 5;
  const reveladas = golpe.comunitarias;
  let cartasHtml = "";
  for (let i = 0; i < slots; i += 1) {
    const c = reveladas[i];
    if (c !== undefined) {
      cartasHtml += `<span data-animate-key="c-${c.valor}-${c.palo}">${cartaHtml(c, "mesa")}</span>`;
    } else {
      cartasHtml +=
        '<div class="carta carta--placeholder carta--mesa" aria-hidden="true"></div>';
    }
  }
  return `
    <div class="mesa-poker__centro-comunitarias">
      <div class="cartas-fila cartas-fila--mesa mesa-poker__comunitarias">${cartasHtml}</div>
    </div>`;
}

export function htmlSeccionComunitarias(golpe: VistaGolpe): string {
  return centroComunitariasHtml(golpe);
}

function poolFichasHtml(
  centro: Ficha[],
  colorActivo: ColorFicha,
  tengoFichaActiva: boolean,
  esShowdown: boolean,
  esEspectador: boolean,
): string {
  const disponibles = centro
    .filter((f) => f.color === colorActivo)
    .sort((a, b) => a.estrellas - b.estrellas);
  if (esShowdown || disponibles.length === 0) {
    return "";
  }

  let cuerpo: string;
  if (esEspectador) {
    cuerpo = disponibles
      .map(
        (f) =>
          `<span data-animate-key="f-${f.color}-${f.estrellas}">${fichaInsigniaHtml(f)}</span>`,
      )
      .join("");
  } else {
    const accion = tengoFichaActiva ? "INTERCAMBIAR_CENTRO" : "TOMAR_FICHA";
    const etiqueta = tengoFichaActiva ? "Intercambiar" : "Tomar";
    cuerpo = disponibles
      .map((f) => {
        const boton = fichaBotonHtml(f, accion, etiqueta);
        return `<span data-animate-key="f-${f.color}-${f.estrellas}">${boton}</span>`;
      })
      .join("");
  }

  return `
    <div class="mesa-poker__pool-centro mesa-poker__pool-centro--${colorActivo.toLowerCase()}">
      <div class="fichas-fila mesa-poker__pool">${cuerpo}</div>
    </div>`;
}

export function htmlPoolCentro(ctx: MesaPokerContexto): string {
  const { golpe, esEspectador, tengoFichaActiva, esShowdown } = ctx;
  return poolFichasHtml(
    golpe.fichas.centro,
    golpe.fichas.colorActivo,
    tengoFichaActiva,
    esShowdown,
    esEspectador,
  );
}

export function htmlHudMarcador(vista: VistaPartida): string {
  return marcadorCompactoHtml(vista);
}

export function htmlHudRonda(vista: VistaPartida, golpe: VistaGolpe): string {
  const colorRonda = COLOR_DE_RONDA[golpe.ronda];
  const etiquetaRonda = ETIQUETA_RONDA[golpe.ronda];
  return `
    <div class="mesa-poker__ronda">
      <span class="mesa-poker__golpe">Golpe ${vista.golpesJugados + 1}</span>
      <span class="mesa-poker__fase">${escapar(etiquetaRonda)}</span>
      ${colorRonda !== null ? indicadorColorFichaHtml(colorRonda) : ""}
    </div>`;
}

export function htmlTemporizadorHud(golpe: VistaGolpe): string {
  return temporizadorHudHtml(golpe);
}

export function htmlToastResultado(vista: VistaPartida): string {
  const r = vista.ultimoResultadoGolpe;
  if (r === null) {
    return "";
  }
  const golpe = vista.golpeActual;
  if (golpe === null || golpe.numero <= r.numero) {
    return "";
  }
  return r.exito
    ? `<div class="mesa-poker__toast mesa-poker__toast--exito" role="status">¡Bóveda abierta! Golpe ${r.numero}</div>`
    : `<div class="mesa-poker__toast mesa-poker__toast--fracaso" role="status">¡Alarma! Golpe ${r.numero}</div>`;
}

export function htmlAvisoTerminacionDesconexion(vista: VistaPartida): string {
  const pendiente = vista.terminacionPorDesconexion;
  if (pendiente == null || vista.fase !== "EN_CURSO") {
    return "";
  }
  const segundos = Math.max(
    0,
    Math.ceil((pendiente.terminaEn - Date.now()) / 1000),
  );
  return `
    <div class="mesa-poker__aviso-desconexion" role="alert" aria-live="polite">
      <strong>${escapar(pendiente.jugadorNombre)} se desconectó.</strong>
      <span>La partida terminará en <span class="mesa-poker__aviso-cuenta">${segundos}</span> s y volveréis al escondite.</span>
    </div>`;
}

export function htmlAsientos(ctx: MesaPokerContexto): string {
  const { vista, golpe, esEspectador, tengoFichaActiva, esShowdown } = ctx;
  const showdownResuelto = esShowdown && showdownMesaCompleto(vista, golpe);
  const yoId = esEspectador ? null : vista.perspectivaJugadorId;
  const colorActivo = golpe.fichas.colorActivo;
  const posiciones = calcularPosicionesAsientos(vista.jugadores, yoId);
  const rivales = posiciones.filter((p) => p.zona === "rival");
  const local = posiciones.find((p) => p.zona === "local");

  const htmlRivales = rivales
    .map((pos) =>
      asientoHtml(
        pos,
        vista,
        colorActivo,
        tengoFichaActiva,
        esShowdown,
        esEspectador,
        golpe,
        showdownResuelto,
      ),
    )
    .join("");

  const htmlLocal =
    local !== undefined
      ? asientoHtml(
          local,
          vista,
          colorActivo,
          tengoFichaActiva,
          esShowdown,
          esEspectador,
          golpe,
          showdownResuelto,
        )
      : "";

  return `
    <div
      class="mesa-poker__rivales"
      style="--rivales-count:${contarRivales(vista.jugadores, yoId)}"
    >${htmlRivales}</div>
    <div class="mesa-poker__local">${htmlLocal}</div>`;
}

function cartasAsientoHtml(
  jugador: JugadorVisible,
  esYo: boolean,
  esShowdown: boolean,
  golpe: VistaGolpe | null,
  esSiguienteRevelar: boolean,
  showdownResuelto: boolean,
): string {
  if (jugador.bolsillo === null) {
    return "";
  }
  const usarCompacto = esYo && showdownResuelto;
  const variante = usarCompacto || !esYo ? "mini" : "hero";
  if (jugador.bolsillo === BOLSILLO_OCULTO) {
    if (esShowdown) {
      return `<div class="asiento__cartas">${cartasOcultasVolteoHtml(variante)}</div>`;
    }
    return `<div class="asiento__cartas">${dorsoCartaHtml(variante)}${dorsoCartaHtml(variante)}</div>`;
  }
  const etiqueta =
    esYo && !usarCompacto
      ? '<span class="asiento__cartas-etiq">Cartas de Bolsillo</span>'
      : "";
  const cartas = esShowdown
    ? cartasVolteoHtml(jugador.bolsillo, variante, true)
    : cartasFilaHtml(jugador.bolsillo, variante);
  const categoria =
    esShowdown && golpe !== null
      ? htmlCategoriaAsientoShowdown(jugador, golpe)
      : "";
  const claseCartas = esSiguienteRevelar ? " asiento__cartas--siguiente" : "";
  return `${etiqueta}<div class="asiento__cartas${claseCartas}">${cartas}</div>${categoria}`;
}

function asientoHtml(
  pos: PosicionAsiento,
  vista: VistaPartida,
  colorActivo: ColorFicha,
  tengoFichaActiva: boolean,
  esShowdown: boolean,
  esEspectador: boolean,
  golpe: VistaGolpe | null,
  showdownResuelto: boolean,
): string {
  const { jugador, x, y, esYo } = pos;
  const fichas = vista.golpeActual?.fichas;
  const susFichas = fichas?.porJugador[jugador.id] ?? [];
  const confirmados = vista.golpeActual?.confirmados ?? [];
  const haConfirmado = confirmados.includes(jugador.id);
  const esSiguienteRevelar =
    esShowdown &&
    golpe !== null &&
    golpe.reveladoShowdown < golpe.ordenShowdown.length &&
    golpe.ordenShowdown[golpe.reveladoShowdown] === jugador.id;
  const claseRevelando = esSiguienteRevelar ? " asiento--revelando" : "";
  const ranurasFichas =
    esShowdown || golpe === null
      ? ""
      : ranurasFichasJugadorHtml(susFichas, colorActivo);

  const otroTieneActiva = susFichas.some((f) => f.color === colorActivo);
  const puedeIntercambiar =
    !esEspectador && !esYo && !esShowdown && otroTieneActiva;
  const botonIntercambio = puedeIntercambiar
    ? `<button type="button" class="asiento__intercambio boton boton--secundario" data-accion="INTERCAMBIAR_JUGADOR" data-jugador="${escapar(jugador.id)}">${tengoFichaActiva ? "Intercambiar Ficha" : "Tomar Ficha"}</button>`
    : "";

  const confirmBadge =
    !esShowdown && haConfirmado
      ? '<span class="asiento__confirmado" title="Listo">✓</span>'
      : "";
  const usarCompacto = esYo && showdownResuelto;
  const claseYo = esYo ? " asiento--yo" : "";
  const claseCompacto = usarCompacto ? " asiento--showdown-compacto" : "";
  const claseZona =
    pos.zona === "local" ? " asiento--local" : " asiento--rival";
  const estiloPosicion =
    pos.zona === "local" ? ` style="--asiento-x:${x}%;--asiento-y:${y}%"` : "";

  return `
    <article
      class="asiento${claseYo}${claseCompacto}${claseZona}${claseRevelando}"${estiloPosicion}
      data-jugador-id="${escapar(jugador.id)}"
    >
      <div class="asiento__cabecera">
        ${estatusJugadorHtml(jugador.conectado)}
        <span class="asiento__nombre">${nombreConTooltipHtml(jugador.nombre, jugador.descripcion)}${esYo ? ' <span class="asiento__tu">(tú)</span>' : ""}</span>
        ${confirmBadge}
      </div>
      ${cartasAsientoHtml(jugador, esYo, esShowdown, golpe, esSiguienteRevelar, showdownResuelto)}
      ${ranurasFichas}
      ${botonIntercambio}
    </article>`;
}

export interface MesaPokerContexto {
  vista: VistaPartida;
  golpe: VistaGolpe;
  esEspectador: boolean;
  tengoFichaActiva: boolean;
  esShowdown: boolean;
}

export function htmlMesaPoker(ctx: MesaPokerContexto): string {
  const { vista, golpe, esEspectador, tengoFichaActiva, esShowdown } = ctx;
  const showdownResuelto = esShowdown && showdownMesaCompleto(vista, golpe);
  const colorActivo = golpe.fichas.colorActivo;
  const colorRonda = COLOR_DE_RONDA[golpe.ronda];
  const etiquetaRonda = ETIQUETA_RONDA[golpe.ronda];
  const asientos = htmlAsientos(ctx);

  const botonTerminar =
    !esEspectador && vista.anfitrionId === vista.perspectivaJugadorId
      ? `<button type="button" id="boton-terminar-partida" class="boton boton--alias mesa-poker__terminar">Terminar partida</button>`
      : "";

  let bannerResultado = htmlToastResultado(vista);
  const avisoDesconexion = htmlAvisoTerminacionDesconexion(vista);

  return `
    <section class="mesa-poker${esEspectador ? " mesa-poker--espectador" : ""}${showdownResuelto ? " mesa-poker--showdown-resuelto" : ""}">
      <div class="mesa-poker__hud">
        ${marcadorCompactoHtml(vista)}
        <div class="mesa-poker__ronda">
          <span class="mesa-poker__golpe">Golpe ${vista.golpesJugados + 1}</span>
          <span class="mesa-poker__fase">${escapar(etiquetaRonda)}</span>
          ${colorRonda !== null ? indicadorColorFichaHtml(colorRonda) : ""}
        </div>
        ${temporizadorHudHtml(golpe)}
        <div class="mesa-poker__hud-derecha">
          ${htmlBotonHistorial(vista)}
          ${botonTerminar}
        </div>
      </div>
      ${avisoDesconexion}
      ${bannerResultado}
      <div class="mesa-poker__mesa">
        <div class="mesa-poker__backdrop" aria-hidden="true"></div>
        <img
          class="mesa-poker__felt"
          src="${escapar(urlMesa())}"
          alt=""
          aria-hidden="true"
        />
        <div class="mesa-poker__centro">
          ${centroComunitariasHtml(golpe)}
          ${poolFichasHtml(golpe.fichas.centro, colorActivo, tengoFichaActiva, esShowdown, esEspectador)}
        </div>
        <div class="mesa-poker__asientos">${asientos}</div>
      </div>
      <div class="mesa-poker__overlay" id="mesa-poker-overlay"></div>
      <footer class="mesa-poker__bar">
        <div class="mesa-poker__bar-info">
          ${esEspectador ? bannerEspectadorHtml() : recordatorioHtml()}
          ${contadorEspectadoresHtml(vista)}
        </div>
        <p class="mesa-poker__lema">Un golpe perfecto se planea en silencio.</p>
        <div class="mesa-poker__bar-acciones">
          <div class="mesa-poker__ranking-slot" id="mesa-footer-ranking"></div>
          <div class="mesa-poker__acciones-slot" id="mesa-poker-acciones"></div>
        </div>
      </footer>
    </section>`;
}

function recordatorioHtml(): string {
  return `
    <div class="recordatorio recordatorio--compacto" role="note">
      <strong>Regla de oro:</strong> Prohibido revelar sus cartas. No sean sapos.
    </div>`;
}

function bannerEspectadorHtml(): string {
  return `
    <div class="recordatorio recordatorio--espectador recordatorio--compacto" role="note">
      <strong>Modo espectador:</strong> observas el golpe sin participar.
    </div>`;
}

function contadorEspectadoresHtml(vista: VistaPartida): string {
  const conectados = vista.espectadores.filter(
    (espectador) => espectador.conectado,
  );
  const total = conectados.length;
  const nombres = conectados.map((espectador) => espectador.nombre).join(", ");
  const etiqueta = total === 1 ? "1 espectador" : `${total} espectadores`;
  return `
    <span class="mesa-poker__espectadores" title="${escapar(nombres)}">
      Observando: <strong class="mesa-poker__espectadores-count">${escapar(etiqueta)}</strong>
    </span>`;
}

export function htmlAccionesMesa(
  esShowdown: boolean,
  vista: VistaPartida,
  esEspectador: boolean,
): string {
  if (esEspectador) {
    return "";
  }
  if (esShowdown) {
    return htmlAccionesShowdown(vista, esEspectador);
  }
  const golpe = vista.golpeActual;
  if (golpe === null) {
    return "";
  }
  const yoId = vista.perspectivaJugadorId;
  const confirmados = golpe.confirmados;
  const yaConfirme = confirmados.includes(yoId);
  const colorActivo = golpe.fichas.colorActivo;
  const misFichas = golpe.fichas.porJugador[yoId] ?? [];
  const tengoFichaActiva = misFichas.some((f) => f.color === colorActivo);
  const deshabilitado = yaConfirme || !tengoFichaActiva ? " disabled" : "";
  const sinFicha = vista.jugadores.filter((j) => {
    const fichas = golpe.fichas.porJugador[j.id] ?? [];
    return !fichas.some((f) => f.color === colorActivo);
  }).length;
  const sinConfirmar = vista.jugadores.filter(
    (j) => !confirmados.includes(j.id),
  ).length;
  let espera = "";
  if (sinFicha > 0) {
    espera = `<p class="mesa-poker__espera">Esperando ficha de ${sinFicha} miembro${sinFicha === 1 ? "" : "s"}…</p>`;
  } else if (sinConfirmar > 0) {
    espera = `<p class="mesa-poker__espera">Esperando confirmación de ${sinConfirmar} miembro${sinConfirmar === 1 ? "" : "s"}…</p>`;
  }
  return `
    <button type="button" id="boton-avanzar" class="boton boton--golpe"${deshabilitado}>
      ${yaConfirme ? "✓ Confirmado" : "Confirmar ficha"}
    </button>
    ${espera}`;
}
