// Vista de la MESA DE JUEGO del Cliente_Jugador (fase EN_CURSO).
//
// Renderiza el Golpe en curso: número de Golpe y Ronda activa, las Cartas
// Comunitarias, las Cartas de Bolsillo PROPIAS, el estado del resto de la banda
// (sin sus cartas), el marcador de Bóvedas doradas y Alarmas rojas, y las Fichas
// (disponibles en el centro y en posesión de cada Jugador). Permite tomar e
// intercambiar Fichas, avanzar de Ronda y resolver el Showdown.
//
// Reglas de comunicación (criterios 10.1, 10.5): esta vista NO ofrece ningún
// control para mostrar, comunicar o insinuar las Cartas de Bolsillo al resto de
// la banda, ni ningún canal de mensajería de texto libre. Además muestra de
// forma visible y permanente el recordatorio de no revelar cartas ni hacer
// bluff (criterio 10.2).
//
// Todos los textos están en español con temática de ladrones y usan los términos
// del glosario (Golpe, Bóveda, Alarma, Ficha, Showdown).
//
// _Requirements: 6.6, 10.1, 10.2, 10.5, 11.1, 11.2_

import type { EstadoCliente } from '../estado';
import type {
  Carta,
  ColorFicha,
  Ficha,
  JugadorVisible,
  Palo,
  VistaPartida,
} from '../protocolo';
import { BOLSILLO_OCULTO, type VistaGolpe } from '../../dominio/proyeccion';
import { estatusJugadorHtml } from './estatusJugador';
import { nombreConTooltipHtml } from './tooltipNombre';

/** Acciones que la vista de la mesa puede solicitar a la capa de aplicación. */
export interface AccionesMesa {
  /** Toma una Ficha disponible del centro (color de la Ronda activa). */
  tomarFicha(ficha: Ficha): void;
  /** Intercambia la Ficha propia del color activo por una del centro. */
  intercambiarCentro(fichaCentro: Ficha): void;
  /** Intercambia la Ficha propia del color activo con la de otro Jugador. */
  intercambiarJugador(jugadorB: string): void;
  /** Avanza a la siguiente Ronda (o al Showdown desde River). */
  avanzar(): void;
  /** Resuelve el Golpe cuando la Ronda activa es el Showdown. */
  resolverShowdown(): void;
}

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

/** Renderiza una Carta boca abajo (dorso), para Jugadores ajenos sin Showdown. */
function dorsoHtml(): string {
  return '<div class="carta carta--dorso" aria-label="Carta oculta">★</div>';
}

/** Nombre legible del color de una Ficha (en femenino, p. ej. "Fichas blancas"). */
const NOMBRE_COLOR: Record<ColorFicha, string> = {
  BLANCO: 'blancas',
  AMARILLO: 'amarillas',
  NARANJA: 'naranjas',
  ROJO: 'rojas',
};

/** Etiqueta temática de cada Ronda del Golpe. */
const ETIQUETA_RONDA: Record<VistaGolpe['ronda'], string> = {
  PRE_FLOP: 'Pre-Flop',
  FLOP: 'Flop',
  TURN: 'Turn',
  RIVER: 'River',
  SHOWDOWN: 'Showdown',
};

/** Color de Ficha asociado a cada Ronda (para el texto de ayuda). */
const COLOR_DE_RONDA: Record<VistaGolpe['ronda'], ColorFicha | null> = {
  PRE_FLOP: 'BLANCO',
  FLOP: 'AMARILLO',
  TURN: 'NARANJA',
  RIVER: 'ROJO',
  SHOWDOWN: null,
};

/** Pinta las estrellas de una Ficha (p. ej. "★★★"). */
function estrellas(n: number): string {
  return '★'.repeat(Math.max(0, n));
}

/** Renderiza una Ficha como insignia no interactiva. */
function fichaInsigniaHtml(ficha: Ficha): string {
  const clase = `ficha ficha--${ficha.color.toLowerCase()}`;
  return `<span class="${clase}" title="${ficha.estrellas} estrellas">${estrellas(
    ficha.estrellas,
  )}</span>`;
}

// ===========================================================================
// Render principal de la mesa
// ===========================================================================

/**
 * Renderiza la mesa de juego dentro de `contenedor` y conecta los eventos a las
 * `acciones`. Se vuelve a invocar en cada cambio de estado recibido del
 * Servidor_Local.
 */
export function renderizarMesa(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesMesa,
): void {
  const vista = estado.vista;
  if (vista === null || vista.golpeActual === null) {
    contenedor.innerHTML = `
      <section class="mesa">
        ${recordatorioHtml()}
        <p class="mesa__espera">Preparando el Golpe…</p>
      </section>`;
    return;
  }

  const golpe = vista.golpeActual;
  const fichas = golpe.fichas;
  const yoId = vista.perspectivaJugadorId;
  const esEspectador = vista.esEspectador;
  const colorActivo = fichas.colorActivo;
  const esShowdown = golpe.ronda === 'SHOWDOWN';

  const misFichas = fichas.porJugador[yoId] ?? [];
  const miFichaActiva = misFichas.find((f) => f.color === colorActivo) ?? null;
  const tengoFichaActiva = !esEspectador && miFichaActiva !== null;

  contenedor.innerHTML = `
    <section class="mesa${esEspectador ? ' mesa--espectador' : ''}">
      ${esEspectador ? bannerEspectadorHtml() : recordatorioHtml()}
      ${cabeceraGolpeHtml(vista, golpe)}
      ${marcadorHtml(vista)}
      ${comunitariasHtml(golpe)}
      ${esEspectador ? '' : bolsilloPropioHtml(vista)}
      ${centroFichasHtml(fichas.centro, colorActivo, tengoFichaActiva, esShowdown, esEspectador)}
      ${bandaHtml(vista, colorActivo, tengoFichaActiva, esShowdown, esEspectador)}
      ${esEspectador ? '' : accionesHtml(esShowdown, vista)}
    </section>
  `;

  if (!esEspectador) {
    enlazarEventos(contenedor, acciones);
  }
}

// ===========================================================================
// Secciones de la vista
// ===========================================================================

/**
 * Recordatorio permanente de no revelar/insinuar/discutir las Cartas de Bolsillo
 * y de que no se permite el bluff (criterio 10.2). Se muestra siempre, en lugar
 * fijo y visible, durante toda la Partida.
 */
function recordatorioHtml(): string {
  return `
    <div class="recordatorio" role="note">
      <strong>Regla de oro de la banda:</strong> está prohibido revelar, insinuar
      o discutir vuestras Cartas de Bolsillo. No se permite el bluff. Coordinad el
      golpe únicamente con vuestras Fichas.
    </div>`;
}

/** Aviso para quien observa sin jugar. */
function bannerEspectadorHtml(): string {
  return `
    <div class="recordatorio recordatorio--espectador" role="note">
      <strong>Modo espectador:</strong> estás observando el golpe. No puedes tomar
      Fichas ni confirmar acciones; las Cartas de Bolsillo se revelan en el Showdown.
    </div>`;
}

/** Cabecera con el número de Golpe, la Ronda activa y la Ficha de la Ronda. */
function cabeceraGolpeHtml(vista: VistaPartida, golpe: VistaGolpe): string {
  const color = COLOR_DE_RONDA[golpe.ronda];
  const ayudaRonda =
    golpe.ronda === 'SHOWDOWN'
      ? 'Hora de la verdad: se comparan las manos.'
      : color != null
        ? `Tomad las Fichas ${NOMBRE_COLOR[color]} para estimar la fuerza de vuestra mano.`
        : '';
  const etiquetaRonda = ETIQUETA_RONDA[golpe.ronda] ?? golpe.ronda;

  return `
    <header class="mesa__cabecera">
      <h2>Golpe ${vista.golpesJugados + 1} · ${escapar(etiquetaRonda)}</h2>
      <p class="mesa__ronda-ayuda">${escapar(ayudaRonda)}</p>
    </header>`;
}

/** Marcador de Bóvedas doradas y Alarmas rojas (objetivo: 3 / penalización: 3). */
function marcadorHtml(vista: VistaPartida): string {
  const bovedas = pintarContador(vista.bovedasDoradas, 3, 'boveda');
  const alarmas = pintarContador(vista.alarmasRojas, 3, 'alarma');
  return `
    <div class="marcador-juego">
      <div class="marcador-juego__grupo">
        <span class="marcador-juego__titulo">Bóvedas doradas</span>
        <span class="marcador-juego__iconos">${bovedas}</span>
        <span class="marcador-juego__cuenta">${vista.bovedasDoradas} / 3</span>
      </div>
      <div class="marcador-juego__grupo">
        <span class="marcador-juego__titulo">Alarmas rojas</span>
        <span class="marcador-juego__iconos">${alarmas}</span>
        <span class="marcador-juego__cuenta">${vista.alarmasRojas} / 3</span>
      </div>
    </div>`;
}

/** Pinta `total` casillas, marcando las primeras `activas` como llenas. */
function pintarContador(activas: number, total: number, tipo: string): string {
  let html = '';
  for (let i = 0; i < total; i += 1) {
    const lleno = i < activas ? `marca--${tipo}-lleno` : `marca--${tipo}-vacio`;
    html += `<span class="marca ${lleno}"></span>`;
  }
  return html;
}

/** Cartas Comunitarias reveladas (0..5), visibles para toda la banda. */
function comunitariasHtml(golpe: VistaGolpe): string {
  const cartas =
    golpe.comunitarias.length === 0
      ? '<p class="mesa__sin-cartas">Aún no hay Cartas Comunitarias sobre la mesa.</p>'
      : `<div class="cartas-fila">${golpe.comunitarias.map(cartaHtml).join('')}</div>`;
  return `
    <section class="bloque">
      <h3>Cartas Comunitarias</h3>
      ${cartas}
    </section>`;
}

/** Cartas de Bolsillo PROPIAS del Jugador local (privadas: solo este cliente). */
function bolsilloPropioHtml(vista: VistaPartida): string {
  const yo = vista.jugadores.find((j) => j.id === vista.perspectivaJugadorId);
  let contenido: string;
  if (yo === undefined || yo.bolsillo === null) {
    contenido = '<p class="mesa__sin-cartas">Aún no has recibido tus Cartas de Bolsillo.</p>';
  } else if (yo.bolsillo === BOLSILLO_OCULTO) {
    // No debería ocurrir para el propio Jugador; se contempla por completitud.
    contenido = '<p class="mesa__sin-cartas">Tus Cartas de Bolsillo no están disponibles.</p>';
  } else {
    contenido = `<div class="cartas-fila">${yo.bolsillo.map(cartaHtml).join('')}</div>`;
  }
  return `
    <section class="bloque bloque--privado">
      <h3>Tus Cartas de Bolsillo <span class="bloque__nota">(solo tú las ves)</span></h3>
      ${contenido}
    </section>`;
}

/**
 * Fichas disponibles en el centro del color activo. Pulsar una Ficha la toma
 * (si aún no tienes Ficha de ese color) o la intercambia por la tuya (si ya
 * tienes una). En el Showdown no se ofrecen acciones de Fichas.
 */
function centroFichasHtml(
  centro: Ficha[],
  colorActivo: ColorFicha,
  tengoFichaActiva: boolean,
  esShowdown: boolean,
  esEspectador = false,
): string {
  const disponibles = centro.filter((f) => f.color === colorActivo);
  disponibles.sort((a, b) => a.estrellas - b.estrellas);

  let cuerpo: string;
  if (esShowdown) {
    cuerpo = '<p class="mesa__sin-cartas">El reparto de Fichas ha terminado en este Golpe.</p>';
  } else if (disponibles.length === 0) {
    cuerpo = `<p class="mesa__sin-cartas">No quedan Fichas ${NOMBRE_COLOR[colorActivo]} en el centro.</p>`;
  } else if (esEspectador) {
    cuerpo = `<div class="fichas-fila fichas-fila--solo-lectura">${disponibles
      .map((f) => fichaInsigniaHtml(f))
      .join('')}</div>`;
  } else {
    const accion = tengoFichaActiva ? 'INTERCAMBIAR_CENTRO' : 'TOMAR_FICHA';
    const etiqueta = tengoFichaActiva ? 'Intercambiar' : 'Tomar';
    cuerpo = `<div class="fichas-fila">${disponibles
      .map(
        (f) => `
        <button
          type="button"
          class="ficha-boton ficha--${f.color.toLowerCase()}"
          data-accion="${accion}"
          data-color="${f.color}"
          data-estrellas="${f.estrellas}"
          title="${etiqueta} la Ficha de ${f.estrellas} estrellas"
        >
          <span class="ficha-boton__estrellas">${estrellas(f.estrellas)}</span>
          <span class="ficha-boton__accion">${etiqueta}</span>
        </button>`,
      )
      .join('')}</div>`;
  }

  return `
    <section class="bloque">
      <h3>Fichas ${NOMBRE_COLOR[colorActivo]} disponibles</h3>
      ${cuerpo}
    </section>`;
}

/**
 * Estado del resto de la banda: cada Jugador con sus Fichas en posesión y sus
 * Cartas de Bolsillo OCULTAS (boca abajo) salvo en el Showdown. Permite proponer
 * un intercambio de Ficha del color activo con otro Jugador que la posea (si
 * tú no tienes, la tomas; si ya tienes, se permutan).
 */
function bandaHtml(
  vista: VistaPartida,
  colorActivo: ColorFicha,
  tengoFichaActiva: boolean,
  esShowdown: boolean,
  esEspectador = false,
): string {
  const filas = vista.jugadores
    .map((jugador) =>
      filaJugadorHtml(jugador, vista, colorActivo, tengoFichaActiva, esShowdown, esEspectador),
    )
    .join('');

  return `
    <section class="bloque">
      <h3>La banda</h3>
      <ul class="banda">${filas}</ul>
    </section>`;
}

/** Renderiza la fila de un Jugador (Fichas, cartas ocultas/reveladas y acción). */
function filaJugadorHtml(
  jugador: JugadorVisible,
  vista: VistaPartida,
  colorActivo: ColorFicha,
  tengoFichaActiva: boolean,
  esShowdown: boolean,
  esEspectador = false,
): string {
  const yoId = vista.perspectivaJugadorId;
  const esYo = jugador.id === yoId;
  const fichas = vista.golpeActual?.fichas;
  const susFichas = fichas?.porJugador[jugador.id] ?? [];
  const confirmados = vista.golpeActual?.confirmados ?? [];
  const haConfirmado = confirmados.includes(jugador.id);

  const insignias =
    susFichas.length === 0
      ? '<span class="banda__sin-fichas">sin Fichas</span>'
      : susFichas.map(fichaInsigniaHtml).join('');

  // Indicador de confirmación
  const indicadorConfirmacion = !esShowdown && haConfirmado
    ? '<span class="banda__confirmado" title="Listo">✓</span>'
    : '';

  // Cartas: el propio Jugador ve las suyas; las ajenas van boca abajo salvo en
  // el Showdown, donde la vista del servidor ya las revela. NUNCA se ofrece un
  // control para revelar cartas (criterios 10.1).
  let cartas: string;
  if (jugador.bolsillo === null) {
    cartas = '';
  } else if (jugador.bolsillo === BOLSILLO_OCULTO) {
    cartas = `<div class="cartas-fila cartas-fila--mini">${dorsoHtml()}${dorsoHtml()}</div>`;
  } else {
    cartas = `<div class="cartas-fila cartas-fila--mini">${jugador.bolsillo
      .map(cartaHtml)
      .join('')}</div>`;
  }

  // Intercambio con otro Jugador: basta con que el OTRO tenga Ficha del color
  // activo (si tú no tienes, la tomas; si ya tienes, se permutan).
  const otroTieneActiva = susFichas.some((f) => f.color === colorActivo);
  const puedeIntercambiar = !esEspectador && !esYo && !esShowdown && otroTieneActiva;
  const etiquetaIntercambio = tengoFichaActiva ? 'Intercambiar Ficha' : 'Tomar Ficha';
  const botonIntercambio = puedeIntercambiar
    ? `<button
         type="button"
         class="boton boton--secundario banda__intercambio"
         data-accion="INTERCAMBIAR_JUGADOR"
         data-jugador="${escapar(jugador.id)}"
       >${etiquetaIntercambio}</button>`
    : '';

  const etiquetaYo = esYo ? ' <span class="banda__tu">(tú)</span>' : '';

  return `
    <li class="banda__jugador">
      <div class="banda__info">
        <span class="banda__nombre">${estatusJugadorHtml(jugador.conectado)}<span class="banda__alias">${nombreConTooltipHtml(jugador.nombre, jugador.descripcion)}${etiquetaYo}</span></span>
        ${indicadorConfirmacion}
        <span class="banda__fichas">${insignias}</span>
      </div>
      ${cartas}
      ${botonIntercambio}
    </li>`;
}

/**
 * Controles de avance del Golpe. "Confirmar ficha" confirma la selección del
 * jugador. Cuando todos confirman, la ronda avanza automáticamente. En el
 * Showdown se ofrece "Resolver el golpe".
 *
 * Esta sección NO incluye ningún control para comunicar cartas ni chat de texto
 * libre (criterios 10.1, 10.5).
 */
function accionesHtml(esShowdown: boolean, vista?: VistaPartida): string {
  if (esShowdown) {
    return `
      <div class="mesa__acciones">
        <button type="button" id="boton-resolver" class="boton boton--golpe">
          Resolver el golpe
        </button>
      </div>`;
  }

  const golpe = vista?.golpeActual;
  const yoId = vista?.perspectivaJugadorId ?? '';
  const confirmados = golpe?.confirmados ?? [];
  const yaConfirme = confirmados.includes(yoId);
  const totalJugadores = vista?.jugadores.length ?? 0;
  const pendientes = totalJugadores - confirmados.length;

  // Comprobar si el jugador tiene ficha del color activo
  const misFichas = golpe?.fichas.porJugador[yoId] ?? [];
  const colorActivo = golpe?.fichas.colorActivo;
  const tengoFichaActiva = colorActivo != null && misFichas.some((f) => f.color === colorActivo);

  const deshabilitado = yaConfirme || !tengoFichaActiva ? ' disabled' : '';
  const textoBoton = yaConfirme ? '✓ Confirmado' : 'Confirmar ficha';

  const mensajeEspera = pendientes > 0
    ? `<p class="mesa__acciones-ayuda">Esperando confirmación de ${pendientes} miembro${pendientes === 1 ? '' : 's'}…</p>`
    : '';

  return `
    <div class="mesa__acciones">
      <button type="button" id="boton-avanzar" class="boton boton--golpe"${deshabilitado}>
        ${textoBoton}
      </button>
      ${mensajeEspera}
    </div>`;
}

// ===========================================================================
// Enlace de eventos
// ===========================================================================

/** Reconstruye una Ficha a partir de los data-atributos de un botón. */
function leerFicha(boton: HTMLElement): Ficha | null {
  const color = boton.dataset['color'] as ColorFicha | undefined;
  const estrellasTxt = boton.dataset['estrellas'];
  if (color === undefined || estrellasTxt === undefined) {
    return null;
  }
  const valor = Number.parseInt(estrellasTxt, 10);
  if (Number.isNaN(valor)) {
    return null;
  }
  return { color, estrellas: valor };
}

/** Conecta los botones renderizados a las acciones de la capa de aplicación. */
function enlazarEventos(contenedor: HTMLElement, acciones: AccionesMesa): void {
  // Tomar / intercambiar con el centro: botones de Ficha del centro.
  const botonesFicha = contenedor.querySelectorAll<HTMLButtonElement>(
    'button[data-accion="TOMAR_FICHA"], button[data-accion="INTERCAMBIAR_CENTRO"]',
  );
  botonesFicha.forEach((boton) => {
    boton.addEventListener('click', () => {
      const ficha = leerFicha(boton);
      if (ficha === null) {
        return;
      }
      if (boton.dataset['accion'] === 'TOMAR_FICHA') {
        acciones.tomarFicha(ficha);
      } else {
        acciones.intercambiarCentro(ficha);
      }
    });
  });

  // Intercambio con otro Jugador.
  const botonesJugador = contenedor.querySelectorAll<HTMLButtonElement>(
    'button[data-accion="INTERCAMBIAR_JUGADOR"]',
  );
  botonesJugador.forEach((boton) => {
    boton.addEventListener('click', () => {
      const jugadorB = boton.dataset['jugador'];
      if (jugadorB !== undefined && jugadorB.length > 0) {
        acciones.intercambiarJugador(jugadorB);
      }
    });
  });

  // Avanzar / resolver el Showdown.
  contenedor
    .querySelector<HTMLButtonElement>('#boton-avanzar')
    ?.addEventListener('click', () => acciones.avanzar());
  contenedor
    .querySelector<HTMLButtonElement>('#boton-resolver')
    ?.addEventListener('click', () => acciones.resolverShowdown());
}
