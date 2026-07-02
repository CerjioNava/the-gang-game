// Vista de LOBBY del Cliente_Jugador: pantalla de título, sala de planificación y vista espectador.

import { espectadorRegistrado, jugadorRegistrado, type EstadoCliente } from '../estado';
import { estatusJugadorHtml } from './estatusJugador';
import { nombreConTooltipHtml } from './tooltipNombre';
import {
  enlazarPanelIdentidad,
  panelIdentidadHtml,
  type AccionesIdentidad,
} from './identityPanel';
import { enlazarTitleScreen, htmlTitleScreen, type AccionesTitleScreen } from './titleScreen';

/** Acciones que la vista de Lobby puede solicitar a la capa de aplicación. */
export interface AccionesLobby extends AccionesTitleScreen, AccionesIdentidad {
  iniciar(): void;
  expulsarMiembro(jugadorId: string): void;
  volverAlMenu(): void;
  reconectarConAlias(nombre: string): void;
}

const JUGADORES_MIN = 3;
const JUGADORES_MAX = 6;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function esNombreEspectadorAutomatico(nombre: string): boolean {
  return /^Espectador \d+$/.test(nombre);
}

function etiquetaEspectador(nombre: string): string {
  return esNombreEspectadorAutomatico(nombre) ? 'En las sombras' : nombre;
}

function claseProgreso(total: number, todosConectados: boolean): string {
  if (total < JUGADORES_MIN) {
    return 'lobby-progress--insuficiente';
  }
  if (!todosConectados) {
    return 'lobby-progress--desconectados';
  }
  return 'lobby-progress--listo';
}

function htmlProgreso(total: number, todosConectados: boolean): string {
  const porcentaje = Math.min(100, Math.round((total / JUGADORES_MAX) * 100));
  const clase = claseProgreso(total, todosConectados);
  return `
    <div
      class="lobby-progress ${clase}"
      role="progressbar"
      aria-valuenow="${total}"
      aria-valuemin="0"
      aria-valuemax="${JUGADORES_MAX}"
      aria-label="Ladrones en la banda"
    >
      <div class="lobby-progress__track">
        <div class="lobby-progress__fill" style="width: ${porcentaje}%"></div>
      </div>
      <span class="lobby-progress__label">${total}/${JUGADORES_MAX}</span>
    </div>`;
}

function htmlTarjetaMiembro(
  id: string,
  nombre: string,
  descripcion: string | undefined,
  conectado: boolean,
  esTu: boolean,
  puedeExpulsar: boolean,
  esEspectador = false,
): string {
  const etiqueta = esTu ? ' <span class="lobby__tu">(tú)</span>' : '';
  const nombreVisible = esEspectador ? etiquetaEspectador(nombre) : nombre;
  const tooltipDesc = esEspectador && esNombreEspectadorAutomatico(nombre) ? undefined : descripcion;
  const botonExpulsar = puedeExpulsar
    ? `<button
         type="button"
         class="boton boton--icono lobby__expulsar"
         data-accion="EXPULSAR"
         data-jugador="${escapar(id)}"
         aria-label="Expulsar a ${escapar(nombreVisible)}"
         title="Expulsar"
       >✕</button>`
    : '';

  return `<li class="crew-card ${esEspectador ? 'crew-card--espectador' : ''}">
    <span class="crew-card__info">${estatusJugadorHtml(conectado)}<span class="crew-card__alias">${nombreConTooltipHtml(nombreVisible, tooltipDesc)}${etiqueta}</span></span>
    ${botonExpulsar}
  </li>`;
}

function enlazarExpulsiones(contenedor: HTMLElement, acciones: AccionesLobby): void {
  contenedor.querySelectorAll<HTMLButtonElement>('button[data-accion="EXPULSAR"]').forEach(
    (boton) => {
      boton.addEventListener('click', () => {
        const jugadorId = boton.dataset['jugador'];
        if (jugadorId !== undefined && jugadorId.length > 0) {
          acciones.expulsarMiembro(jugadorId);
        }
      });
    },
  );
}

function enlazarIniciar(contenedor: HTMLElement, acciones: AccionesLobby): void {
  contenedor.querySelector<HTMLButtonElement>('#boton-iniciar')?.addEventListener('click', () => {
    acciones.iniciar();
  });
}

function htmlBotonVolverMenu(): string {
  return `<button
    type="button"
    class="boton boton--secundario lobby-room__volver"
    data-accion="VOLVER_MENU"
    aria-label="Volver al menú de inicio"
  >← Volver al menú</button>`;
}

function enlazarVolverMenu(contenedor: HTMLElement, acciones: AccionesLobby): void {
  contenedor
    .querySelector<HTMLButtonElement>('[data-accion="VOLVER_MENU"]')
    ?.addEventListener('click', () => {
      acciones.volverAlMenu();
    });
}

/** Pantalla para reincorporarse a una partida EN_CURSO con el mismo alias. */
export function renderizarReconexion(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesLobby,
): void {
  const credencial = estado.nombreBorrador.trim();
  const reconectando = estado.reconectando;
  const aliasPrellenado = credencial.length > 0 ? credencial : '';

  contenedor.innerHTML = `
    <section class="lobby-room lobby-room--reconexion">
      <header class="lobby-room__cabecera">
        <h2 class="lobby-room__titulo">Reconectar al golpe</h2>
        <p class="lobby-room__intro">
          La partida sigue en marcha. Introduce el mismo alias con el que entraste para recuperar tu sitio.
        </p>
      </header>
      <div class="lobby-room__panel lobby-room__panel--reconexion">
        ${
          reconectando
            ? `<p class="lobby-room__reconectando" role="status">Reconectando…</p>`
            : `
        <label class="lobby-room__etiq" for="reconexion-alias">Tu alias</label>
        <input
          type="text"
          id="reconexion-alias"
          class="lobby-room__input"
          maxlength="20"
          value="${escapar(aliasPrellenado)}"
          placeholder="El alias de tu ladrón"
          ${reconectando ? 'disabled' : ''}
        />
        <button type="button" class="boton boton--golpe lobby-room__reconectar" data-accion="RECONNECT">
          Volver a la banda
        </button>`
        }
        <button type="button" class="boton boton--secundario lobby-room__espectador-alt" data-accion="ENTRAR_ESPECTADOR">
          Observar como espectador
        </button>
      </div>
    </section>
  `;

  if (!reconectando) {
    contenedor.querySelector<HTMLButtonElement>('[data-accion="RECONNECT"]')?.addEventListener('click', () => {
      const input = contenedor.querySelector<HTMLInputElement>('#reconexion-alias');
      const nombre = input?.value.trim() ?? '';
      if (nombre.length > 0) {
        acciones.reconectarConAlias(nombre);
      }
    });
  }

  contenedor.querySelector<HTMLButtonElement>('[data-accion="ENTRAR_ESPECTADOR"]')?.addEventListener('click', () => {
    acciones.entrarComoEspectador();
  });
}

/** Pantalla para unirse como espectador con la Partida ya en curso. */
export function renderizarEntradaEspectador(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesLobby,
): void {
  const fase = estado.vista?.fase ?? 'EN_CURSO';
  const intro =
    fase === 'FINALIZADA'
      ? 'El golpe ya terminó. Solo puedes revisar el resultado si ya estabas observando.'
      : 'La Partida está en marcha. Puedes observar a la banda sin participar en el juego.';

  contenedor.innerHTML = `
    <section class="lobby-room lobby-room--espectador-entrada">
      <header class="lobby-room__cabecera">
        <h2 class="lobby-room__titulo">Observar el golpe</h2>
        <p class="lobby-room__intro">${intro}</p>
      </header>
      <div class="lobby-room__panel">
        <p class="lobby-room__pasivo">No necesitas alias ni credencial: entra directo a las sombras.</p>
        <button type="button" class="boton boton--title boton--title-espectador" data-accion="ENTRAR_ESPECTADOR">
          <span class="title-screen__btn-label">Observar ahora</span>
          <span class="title-screen__btn-hint">Mirar desde las sombras</span>
        </button>
      </div>
    </section>
  `;

  contenedor
    .querySelector<HTMLButtonElement>('[data-accion="ENTRAR_ESPECTADOR"]')
    ?.addEventListener('click', () => {
      acciones.entrarComoEspectador();
    });
}

function renderizarTitleScreen(
  contenedor: HTMLElement,
  acciones: AccionesLobby,
): void {
  contenedor.innerHTML = htmlTitleScreen();
  enlazarTitleScreen(contenedor, acciones);
}

function renderizarSalaEspectador(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesLobby,
): void {
  const vista = estado.vista;
  const jugadores = vista?.jugadores ?? [];
  const espectadores = vista?.espectadores ?? [];
  const perspectivaId = vista?.perspectivaJugadorId ?? '';
  const esJugadorLocal = jugadorRegistrado(estado);
  const total = jugadores.length;
  const todosConectados = jugadores.every((j) => j.conectado);

  const listaHtml =
    total === 0
      ? '<li class="lobby__vacio">Aún no hay nadie en el escondite.</li>'
      : jugadores
          .map((j) => {
            const esTu = j.id === perspectivaId;
            const puedeExpulsar = esJugadorLocal && !esTu;
            return htmlTarjetaMiembro(j.id, j.nombre, j.descripcion, j.conectado, esTu, puedeExpulsar);
          })
          .join('');

  const listaEspectadoresHtml =
    espectadores.length === 0
      ? '<li class="lobby__vacio">Nadie observa todavía.</li>'
      : espectadores
          .map((e) => {
            const esTu = e.id === perspectivaId;
            const puedeExpulsar = esJugadorLocal && !esTu;
            return htmlTarjetaMiembro(
              e.id,
              e.nombre,
              e.descripcion,
              e.conectado,
              esTu,
              puedeExpulsar,
              true,
            );
          })
          .join('');

  contenedor.innerHTML = `
    <section class="lobby-room lobby-room--espectador">
      <header class="lobby-room__cabecera">
        ${htmlBotonVolverMenu()}
        <h2 class="lobby-room__titulo">Observando el escondite</h2>
        <p class="lobby-room__intro">Estás en las sombras. La banda planea el golpe mientras tú vigilas.</p>
      </header>
      ${htmlProgreso(total, todosConectados)}
      <div class="lobby-room__grid">
        <div class="lobby-room__columna">
          <h3 class="lobby-room__seccion">Miembros de la banda</h3>
          <ul class="lobby-room__lista">${listaHtml}</ul>
        </div>
        <div class="lobby-room__columna">
          <h3 class="lobby-room__seccion">Espectadores (${espectadores.length})</h3>
          <ul class="lobby-room__lista">${listaEspectadoresHtml}</ul>
        </div>
      </div>
    </section>
  `;

  enlazarVolverMenu(contenedor, acciones);
  enlazarExpulsiones(contenedor, acciones);
}

function renderizarSalaPlanificacion(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesLobby,
): void {
  const vista = estado.vista;
  const jugadores = vista?.jugadores ?? [];
  const espectadores = vista?.espectadores ?? [];
  const perspectivaId = vista?.perspectivaJugadorId ?? '';
  const yo = jugadores.find((j) => j.id === perspectivaId);
  const total = jugadores.length;
  const todosConectados = jugadores.every((j) => j.conectado);
  const aforoValido = total >= JUGADORES_MIN && total <= JUGADORES_MAX;
  const puedeIniciar = aforoValido && todosConectados;
  const hayDesconectados = jugadores.some((j) => !j.conectado);

  const listaHtml = jugadores
    .map((j) => {
      const esTu = j.id === perspectivaId;
      const puedeExpulsar = !esTu;
      return htmlTarjetaMiembro(j.id, j.nombre, j.descripcion, j.conectado, esTu, puedeExpulsar);
    })
    .join('');

  const listaEspectadoresHtml =
    espectadores.length === 0
      ? '<li class="lobby__vacio">Nadie observa todavía.</li>'
      : espectadores
          .map((e) =>
            htmlTarjetaMiembro(e.id, e.nombre, e.descripcion, e.conectado, false, true, true),
          )
          .join('');

  let avisoInicio = '';
  if (!aforoValido) {
    avisoInicio = `<p class="lobby-room__aviso">Hacen falta al menos ${JUGADORES_MIN} ladrones para dar el golpe.</p>`;
  } else if (hayDesconectados) {
    avisoInicio =
      '<p class="lobby-room__aviso">Todos los miembros deben estar activos para dar el golpe.</p>';
  }

  const nombreActual = yo?.nombre ?? estado.nombreBorrador;
  const descActual = yo?.descripcion ?? estado.descripcionBorrador;

  contenedor.innerHTML = `
    <section class="lobby-room lobby-room--planificacion">
      <header class="lobby-room__cabecera">
        ${htmlBotonVolverMenu()}
        <h2 class="lobby-room__titulo">Sala de planificación</h2>
        <p class="lobby-room__intro">
          Reúne a tu banda (${JUGADORES_MIN}–${JUGADORES_MAX} ladrones) antes de asaltar la Bóveda.
        </p>
      </header>
      ${htmlProgreso(total, todosConectados)}
      <div class="lobby-room__grid lobby-room__grid--planificacion">
        <div class="lobby-room__columna lobby-room__columna--identidad">
          ${panelIdentidadHtml(estado, nombreActual, descActual)}
          <button
            type="button"
            id="boton-iniciar"
            class="boton boton--golpe lobby-room__iniciar"
            ${puedeIniciar ? '' : 'disabled'}
          >
            Dar el golpe
          </button>
          ${avisoInicio}
        </div>
        <div class="lobby-room__columna">
          <h3 class="lobby-room__seccion">La banda</h3>
          <ul class="lobby-room__lista">${listaHtml || '<li class="lobby__vacio">Esperando ladrones…</li>'}</ul>
          <h3 class="lobby-room__seccion">Espectadores (${espectadores.length})</h3>
          <ul class="lobby-room__lista">${listaEspectadoresHtml}</ul>
        </div>
      </div>
    </section>
  `;

  enlazarVolverMenu(contenedor, acciones);
  enlazarPanelIdentidad(contenedor, estado, acciones);
  enlazarIniciar(contenedor, acciones);
  enlazarExpulsiones(contenedor, acciones);
}

/**
 * Renderiza la vista de Lobby dentro de `contenedor` y conecta los eventos a las
 * `acciones`. Se vuelve a invocar en cada cambio de estado relevante.
 */
export function renderizarLobby(
  contenedor: HTMLElement,
  estado: EstadoCliente,
  acciones: AccionesLobby,
): void {
  const esJugador = jugadorRegistrado(estado);
  const esEspectador = espectadorRegistrado(estado);
  const registrado = esJugador || esEspectador;

  if (!registrado) {
    renderizarTitleScreen(contenedor, acciones);
    return;
  }

  if (esEspectador) {
    renderizarSalaEspectador(contenedor, estado, acciones);
    return;
  }

  renderizarSalaPlanificacion(contenedor, estado, acciones);
}
