// Vista de LOBBY del Cliente_Jugador.

//

// Permite a un Jugador unirse a la banda con un nombre (1..20 caracteres),

// muestra la lista de miembros ya registrados y ofrece el botón para "Dar el

// golpe" (iniciar la Partida), habilitado solo con 3..6 Jugadores conectados.

//

// Todos los textos están en español con temática de ladrones y usan los términos

// del glosario (Golpe, Bóveda, Alarma, Ficha, Showdown).

//

// _Requirements: 2.1, 2.5, 11.1, 11.2_



import { espectadorRegistrado, jugadorRegistrado, type EstadoCliente } from '../estado';

import { estatusJugadorHtml } from './estatusJugador';
import { nombreConTooltipHtml } from './tooltipNombre';

import {
  enlazarSelectorAlias,
  selectorAliasEspectadorHtml,
  selectorAliasHtml,
  type AccionesEntradaLobby,
} from './selectorAlias';



/** Acciones que la vista de Lobby puede solicitar a la capa de aplicación. */

export interface AccionesLobby extends AccionesEntradaLobby {

  /** Envía la intención de iniciar la Partida (dar el golpe). */

  iniciar(): void;

  /** Expulsa a un miembro de la banda (solo anfitrión). */

  expulsarMiembro(jugadorId: string): void;

  /** Envía la configuración de ajustes del modo de juego. */

  configurarAjustes(ajustes: { sinKickers: boolean }): void;

}



/** Rango de Jugadores admitido por el Modo Básico. */

const JUGADORES_MIN = 3;

const JUGADORES_MAX = 6;



/** Escapa texto para insertarlo de forma segura como contenido HTML. */

function escapar(texto: string): string {

  return texto

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;');

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
    <section class="lobby lobby--espectador">
      <header class="lobby__cabecera">
        <h2>Observar el golpe</h2>
        <p class="lobby__intro">${intro}</p>
      </header>
      ${selectorAliasEspectadorHtml(estado)}
    </section>
  `;

  enlazarSelectorAlias(contenedor, estado, acciones);
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

  const vista = estado.vista;

  const jugadores = vista?.jugadores ?? [];

  const espectadores = vista?.espectadores ?? [];

  const esJugador = jugadorRegistrado(estado);

  const esEspectador = espectadorRegistrado(estado);

  const registrado = esJugador || esEspectador;

  const total = jugadores.length;

  const todosConectados = jugadores.every((j) => j.conectado);

  const aforoValido = total >= JUGADORES_MIN && total <= JUGADORES_MAX;

  const puedeIniciar = aforoValido && todosConectados;

  const esAnfitrion = vista?.anfitrionId != null && vista.perspectivaJugadorId === vista.anfitrionId;

  const hayDesconectados = jugadores.some((j) => !j.conectado);



  const listaHtml =

    total === 0

      ? '<li class="lobby__vacio">Aún no hay nadie en el escondite. Sé el primero en unirte.</li>'

      : jugadores

          .map((j) => {

            const esTu = vista !== null && j.id === vista.perspectivaJugadorId;

            const etiqueta = esTu ? ' <span class="lobby__tu">(tú)</span>' : '';

            const botonExpulsar =

              esAnfitrion && !esTu

                ? `<button

                     type="button"

                     class="boton boton--secundario lobby__expulsar"

                     data-accion="EXPULSAR"

                     data-jugador="${escapar(j.id)}"

                   >Expulsar</button>`

                : '';

            return `<li class="lobby__jugador">

              <span class="lobby__jugador-info">${estatusJugadorHtml(j.conectado)}<span class="lobby__alias">${nombreConTooltipHtml(j.nombre, j.descripcion)}${etiqueta}</span></span>

              ${botonExpulsar}

            </li>`;

          })

          .join('');



  const listaEspectadoresHtml =

    espectadores.length === 0

      ? '<li class="lobby__vacio">Nadie observa todavía.</li>'

      : espectadores

          .map((e) => {

            const esTu = vista !== null && e.id === vista.perspectivaJugadorId;

            const etiqueta = esTu ? ' <span class="lobby__tu">(tú)</span>' : '';

            const botonExpulsar =

              esAnfitrion && !esTu

                ? `<button

                     type="button"

                     class="boton boton--secundario lobby__expulsar"

                     data-accion="EXPULSAR"

                     data-jugador="${escapar(e.id)}"

                   >Expulsar</button>`

                : '';

            return `<li class="lobby__jugador lobby__jugador--espectador">

              <span class="lobby__jugador-info">${estatusJugadorHtml(e.conectado)}<span class="lobby__alias">${nombreConTooltipHtml(e.nombre, e.descripcion)}${etiqueta}</span></span>

              ${botonExpulsar}

            </li>`;

          })

          .join('');



  let avisoInicio = '';

  if (!esAnfitrion && registrado) {

    avisoInicio = '<p class="lobby__aviso">Solo el anfitrión puede dar el golpe.</p>';

  } else if (!aforoValido) {

    avisoInicio = `<p class="lobby__aviso">Hacen falta al menos ${JUGADORES_MIN} ladrones para dar el golpe.</p>`;

  } else if (hayDesconectados) {

    avisoInicio =

      '<p class="lobby__aviso">Todos los miembros deben estar activos para dar el golpe.</p>';

  }



  contenedor.innerHTML = `

    <section class="lobby">

      <header class="lobby__cabecera">

        <h2>El escondite</h2>

        <p class="lobby__intro">

          Reúne a tu banda para planear el Golpe. Necesitáis entre

          ${JUGADORES_MIN} y ${JUGADORES_MAX} ladrones para asaltar la Bóveda.

        </p>

      </header>



      ${

        esEspectador

          ? `<p class="lobby__estado-unido lobby__estado-espectador">Estás observando como espectador. Esperando a que dé comienzo el golpe…</p>`

          : esJugador

          ? `<p class="lobby__estado-unido">Estás dentro de la banda. Esperando a más miembros…</p>`

          : `

        ${selectorAliasHtml(estado)}

        `

      }



      <div class="lobby__miembros">

        <h3>Miembros de la banda (${total}/${JUGADORES_MAX})</h3>

        <ul class="lobby__lista">${listaHtml}</ul>

      </div>



      <div class="lobby__espectadores">

        <h3>Espectadores (${espectadores.length})</h3>

        <ul class="lobby__lista">${listaEspectadoresHtml}</ul>

      </div>



      <fieldset class="lobby__ajustes" ${!esAnfitrion || esEspectador ? 'disabled' : ''}>

        <legend>Ajustes del Golpe</legend>

        <div class="lobby__ajuste-fila">

          <label class="switch" for="check-sin-kickers">

            <input

              type="checkbox"

              id="check-sin-kickers"

              role="switch"

              ${estado.vista?.ajustes?.sinKickers ? 'checked' : ''}

              ${!esAnfitrion ? 'disabled' : ''}

            />

            <span class="switch__slider"></span>

          </label>

          <span class="lobby__ajuste-texto">Jugar sin kickers</span>

        </div>

        <p class="lobby__ajuste-desc">

          Al empatar en categoría, se comparan las cartas de bolsillo en vez de los kickers.

        </p>

        ${!esAnfitrion && registrado ? '<p class="lobby__ajuste-nota">Solo el anfitrión puede cambiar los ajustes.</p>' : ''}

      </fieldset>



      <button

        type="button"

        id="boton-iniciar"

        class="boton boton--golpe"

        ${puedeIniciar && esAnfitrion && esJugador ? '' : 'disabled'}

      >

        Dar el golpe

      </button>

      ${avisoInicio}

    </section>

  `;



  // Enlaces de eventos.

  if (!registrado) {

    enlazarSelectorAlias(contenedor, estado, acciones);

  }



  const botonIniciar = contenedor.querySelector<HTMLButtonElement>('#boton-iniciar');

  botonIniciar?.addEventListener('click', () => {

    acciones.iniciar();

  });



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



  const checkSinKickers = contenedor.querySelector<HTMLInputElement>('#check-sin-kickers');

  checkSinKickers?.addEventListener('change', () => {

    acciones.configurarAjustes({ sinKickers: checkSinKickers.checked });

  });

}

